// client/src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsAPI } from '../services/api';
import { getMyProfile } from '../services/profile';
import { authService } from '../services/auth';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import ConfirmDialog from './ConfirmDialog';
import Pagination from './Pagination';
import './Dashboard.css';

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, projectId: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const { data: profile } = useQuery({
    queryKey: ['myProfile'],
    queryFn: () => getMyProfile(),
    retry: false, // Don't retry on 404
    refetchOnWindowFocus: false,
    // Don't throw error - gracefully handle missing profiles
    throwOnError: false,
  });

  const { data: projectsData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['projects', currentPage],
    queryFn: () => projectsAPI.getAll({ limit: itemsPerPage, offset: (currentPage - 1) * itemsPerPage }),
  });

  // Handle both old format (array) and new format (object with data and pagination)
  const projects = projectsData?.data || projectsData || [];
  const pagination = projectsData?.pagination || null;

  const error = queryError?.message || '';

  const handleCreateProject = async (projectData) => {
    try {
      const newProject = await projectsAPI.create(projectData);
      // Invalidate queries to refetch with pagination
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowForm(false);
      // Reset to first page to show the new project
      setCurrentPage(1);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateProject = async (id, projectData) => {
    try {
      const updatedProject = await projectsAPI.update(id, projectData);
      // Invalidate queries to refetch with pagination
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingProject(null);
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteConfirm({ isOpen: true, projectId: id });
  };

  const handleDeleteConfirm = async () => {
    const { projectId } = deleteConfirm;
    if (!projectId) return;

    try {
      await projectsAPI.delete(projectId);
      // Invalidate queries to refetch with pagination
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteConfirm({ isOpen: false, projectId: null });
      // If current page becomes empty, go to previous page
      if (projects.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (err) {
      // Error will be handled by the UI if needed
      setDeleteConfirm({ isOpen: false, projectId: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, projectId: null });
  };

  const handleEditClick = (project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  const handleProfileClick = () => {
    if (profile?.username) {
      navigate(`/u/${profile.username}`);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>OrderedPM</h1>
        <div className="dashboard-header-actions">
          {profile && (
            <button 
              onClick={handleProfileClick}
              className="btn-user-profile"
              title={`View ${profile.full_name || profile.username}'s profile`}
            >
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name || profile.username}
                  className="user-avatar-mini"
                />
              ) : (
                <div className="user-avatar-mini-placeholder">
                  <span>👤</span>
                </div>
              )}
              <span className="user-name-mini">
                {profile.full_name || profile.username}
              </span>
            </button>
          )}
          <button onClick={onLogout} className="btn-secondary">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="dashboard-actions">
          <h2>My Projects</h2>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            + New Project
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {showForm && (
          <ProjectForm
            project={editingProject}
            onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
            onCancel={handleFormClose}
          />
        )}

        {loading ? (
          <div className="loading">Loading projects...</div>
        ) : (
          <>
            <ProjectList
              projects={projects}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(pagination.total / itemsPerPage)}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={pagination.total}
                isLoading={loading}
              />
            )}
          </>
        )}

        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title="Delete Project"
          message="Are you sure you want to delete this project? All tasks will be deleted too. This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmButtonClass="btn-danger"
        />
      </main>
    </div>
  );
}

export default Dashboard;

