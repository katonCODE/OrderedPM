// client/src/components/Dashboard.js
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsAPI } from '../services/api';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import './Dashboard.css';

function Dashboard({ onLogout }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const { data: projects = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsAPI.getAll(),
  });

  const error = queryError?.message || '';

  const handleCreateProject = async (projectData) => {
    try {
      const newProject = await projectsAPI.create(projectData);
      queryClient.setQueryData(['projects'], (old) => [newProject, ...(old || [])]);
      setShowForm(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateProject = async (id, projectData) => {
    try {
      const updatedProject = await projectsAPI.update(id, projectData);
      queryClient.setQueryData(['projects'], (old) => 
        (old || []).map(p => p.id === id ? updatedProject : p)
      );
      setEditingProject(null);
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project? All tasks will be deleted too.')) {
      return;
    }
    try {
      await projectsAPI.delete(id);
      queryClient.setQueryData(['projects'], (old) => (old || []).filter(p => p.id !== id));
    } catch (err) {
      // Error will be handled by the UI if needed
    }
  };

  const handleEditClick = (project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>OrderedPM</h1>
        <button onClick={onLogout} className="btn-secondary">
          Logout
        </button>
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
          <ProjectList
            projects={projects}
            onEdit={handleEditClick}
            onDelete={handleDeleteProject}
          />
        )}
      </main>
    </div>
  );
}

export default Dashboard;

