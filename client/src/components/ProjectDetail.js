// client/src/components/ProjectDetail.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI, tasksAPI } from '../services/api';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import './ProjectDetail.css';

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const loadProject = useCallback(async () => {
    try {
      const data = await projectsAPI.getById(id);
      setProject(data);
    } catch (err) {
      setError(err.message || 'Failed to load project');
    }
  }, [id]);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tasksAPI.getByProject(id);
      setTasks(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
    loadTasks();
  }, [loadProject, loadTasks]);

  const handleCreateTask = async (taskData) => {
    try {
      const newTask = await tasksAPI.create(taskData);
      setTasks([newTask, ...tasks]);
      setShowForm(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateTask = async (taskId, taskData) => {
    try {
      const updatedTask = await tasksAPI.update(taskId, taskData);
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      setEditingTask(null);
      setShowForm(false);
    } catch (err) {
      throw err;
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }
    try {
      await tasksAPI.delete(taskId);
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      setError(err.message || 'Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        const updatedTask = await tasksAPI.update(taskId, {
          title: task.title,
          description: task.description,
          status: newStatus,
        });
        setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      }
    } catch (err) {
      setError(err.message || 'Failed to update task status');
    }
  };

  const handleEditClick = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  if (loading && !project) {
    return <div className="loading">Loading project...</div>;
  }

  if (!project) {
    return (
      <div className="error-container">
        <p>Project not found</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="project-detail">
      <header className="project-detail-header">
        <button onClick={() => navigate('/')} className="btn-back">
          ← Back to Projects
        </button>
        <div className="project-info">
          <h1>{project.name}</h1>
          {project.description && <p className="project-description">{project.description}</p>}
        </div>
      </header>

      <main className="project-detail-content">
        <div className="project-actions">
          <h2>Tasks</h2>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            + New Task
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {showForm && (
          <TaskForm
            task={editingTask}
            projectId={id}
            onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
            onCancel={handleFormClose}
          />
        )}

        {loading ? (
          <div className="loading">Loading tasks...</div>
        ) : (
          <TaskList
            tasks={tasks}
            onEdit={handleEditClick}
            onDelete={handleDeleteTask}
            onStatusChange={handleStatusChange}
          />
        )}
      </main>
    </div>
  );
}

export default ProjectDetail;

