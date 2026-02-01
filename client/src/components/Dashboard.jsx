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

  const { data: projectsData, isFetching, isLoading: initialLoading, error: queryError } = useQuery({
    queryKey: ['projects', currentPage],
    queryFn: () => projectsAPI.getAll({
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
      includeCount: false // Don't request count - rely on hasMore for pagination
    }),
    placeholderData: (previousData) => previousData, // Show cached data immediately while fetching
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
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0]">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                OrderedPM
              </span>
            </h1>
            <div className="flex items-center gap-4">
              {profile && (
                <button
                  onClick={handleProfileClick}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                  title={`View ${profile.full_name || profile.username}'s profile`}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || profile.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <span>👤</span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-[#e0e0e0] hidden sm:inline">
                    {profile.full_name || profile.username}
                  </span>
                </button>
              )}
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#e0e0e0]">My Projects</h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20"
          >
            + New Project
          </button>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {showForm && (
          <div className="mb-8">
            <ProjectForm
              project={editingProject}
              onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
              onCancel={handleFormClose}
            />
          </div>
        )}

        {initialLoading && !projectsData ? (
          <div className="text-center py-20 text-gray-400 text-lg">Loading projects...</div>
        ) : (
          <>
            {isFetching && projectsData && (
              <div className="text-center py-4 text-gray-500 text-sm italic opacity-70">
                Refreshing projects...
              </div>
            )}
            <ProjectList
              projects={projects}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
            {pagination && pagination.hasMore && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={pagination.total !== null ? Math.ceil(pagination.total / itemsPerPage) : null}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  totalItems={pagination.total}
                  hasMore={pagination.hasMore}
                  isLoading={isFetching}
                />
              </div>
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

