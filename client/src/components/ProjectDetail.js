// client/src/components/ProjectDetail.js
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsAPI, tasksAPI } from '../services/api';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import './ProjectDetail.css';

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [filterPriority, setFilterPriority] = useState('all');

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsAPI.getById(id),
  });

  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksAPI.getByProject(id),
  });

  const loading = projectLoading || tasksLoading;
  const error = projectError?.message || tasksError?.message || '';

  // Process tasks: filter and sort
  const processedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by priority
    if (filterPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }

    // Sort tasks
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityMap = { high: 3, medium: 2, low: 1 };
          const aPriority = priorityMap[a.priority] || 2;
          const bPriority = priorityMap[b.priority] || 2;
          return bPriority - aPriority;
        
        case 'due_date':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        
        case 'newest':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return filtered;
  }, [tasks, sortBy, filterPriority]);

  const handleCreateTask = async (taskData) => {
    try {
      const newTask = await tasksAPI.create(taskData);
      queryClient.setQueryData(['tasks', id], (old) => [newTask, ...(old || [])]);
      setShowForm(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateTask = async (taskId, taskData) => {
    try {
      const updatedTask = await tasksAPI.update(taskId, taskData);
      queryClient.setQueryData(['tasks', id], (old) => 
        (old || []).map(t => t.id === taskId ? updatedTask : t)
      );
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
      queryClient.setQueryData(['tasks', id], (old) => (old || []).filter(t => t.id !== taskId));
    } catch (err) {
      // Error will be handled by the UI if needed
    }
  };

  const statusUpdateMutation = useMutation({
    mutationFn: ({ taskId, newStatus, task }) => {
      return tasksAPI.update(taskId, {
        title: task.title,
        description: task.description,
        status: newStatus,
        due_date: task.due_date || null,
        priority: task.priority || 'medium',
      });
    },
    onMutate: async ({ taskId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', id] });
      const previousTasks = queryClient.getQueryData(['tasks', id]);
      const task = previousTasks?.find(t => t.id === taskId);
      
      if (task) {
        queryClient.setQueryData(['tasks', id], (old) =>
          (old || []).map(t => t.id === taskId ? { ...t, status: newStatus } : t)
        );
      }
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', id], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });

  const handleStatusChange = (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      statusUpdateMutation.mutate({ taskId, newStatus, task });
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
    return (
      <div className="loading-screen">
        <div className="loading-animation">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
        <p className="loading-text">Loading project...</p>
      </div>
    );
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

        {!loading && (
          <div className="tasks-toolbar">
            <div className="toolbar-controls">
              <div className="toolbar-control">
                <label htmlFor="sort-by">Sort By</label>
                <select
                  id="sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="toolbar-select"
                >
                  <option value="newest">Newest</option>
                  <option value="due_date">Due Date: Soonest</option>
                  <option value="priority">Priority: High to Low</option>
                </select>
              </div>

              <div className="toolbar-control">
                <label htmlFor="filter-priority">Filter Priority</label>
                <select
                  id="filter-priority"
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="toolbar-select"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High Only</option>
                  <option value="medium">Medium Only</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading tasks...</div>
        ) : (
          <TaskList
            tasks={processedTasks}
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

