// client/src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { projectsAPI } from '../services/api';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import './Dashboard.css';

function Dashboard({ onLogout }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectsAPI.getAll();
      setProjects(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (projectData) => {
    try {
      const newProject = await projectsAPI.create(projectData);
      setProjects([newProject, ...projects]);
      setShowForm(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateProject = async (id, projectData) => {
    try {
      const updatedProject = await projectsAPI.update(id, projectData);
      setProjects(projects.map(p => p.id === id ? updatedProject : p));
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
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete project');
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

