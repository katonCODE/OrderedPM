// client/src/components/ProjectDetail.js
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsAPI, tasksAPI } from '../services/api';
import KanbanBoard from './KanbanBoard';
import MiniCalendar from './MiniCalendar';
import Timeline from './Timeline';
import TaskForm from './TaskForm';
import './ProjectDetail.css';

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsAPI.getById(id),
  });

  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksAPI.getByProject(id, { limit: 1000, offset: 0 }), // Large limit for Kanban view
  });

  // Handle both old format (array) and new format (object with data and pagination)
  // For KanbanBoard, we need all tasks, so we use a large limit
  const tasks = tasksData?.data || tasksData || [];

  const loading = projectLoading || tasksLoading;
  const error = projectError?.message || tasksError?.message || '';

  const handleCreateTask = async (taskData) => {
    try {
      const newTask = await tasksAPI.create(taskData);
      queryClient.setQueryData(['tasks', id], (old) => {
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = [newTask, ...oldArray];
        
        // Return in same format as received
        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });
      setShowForm(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateTask = async (taskId, taskData) => {
    try {
      const updatedTask = await tasksAPI.update(taskId, taskData);
      queryClient.setQueryData(['tasks', id], (old) => {
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = oldArray.map(t => t.id === taskId ? updatedTask : t);
        
        // Return in same format as received
        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });
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
      queryClient.setQueryData(['tasks', id], (old) => {
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = oldArray.filter(t => t.id !== taskId);
        
        // Return in same format as received
        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });
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
      
      // Handle both array and paginated object formats
      const tasksArray = Array.isArray(previousTasks)
        ? previousTasks
        : previousTasks?.data || [];
      
      const task = tasksArray.find(t => t.id === taskId);
      
      if (task) {
        queryClient.setQueryData(['tasks', id], (old) => {
          const oldArray = Array.isArray(old) ? old : old?.data || [];
          const updatedArray = oldArray.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
          
          // Return in same format as received
          if (Array.isArray(old)) {
            return updatedArray;
          } else if (old && typeof old === 'object' && 'data' in old) {
            return { ...old, data: updatedArray };
          }
          return updatedArray;
        });
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

  const positionUpdateMutation = useMutation({
    mutationFn: ({ taskId, prevPosition, nextPosition, status }) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');
      
      // Always update status if provided (for cross-column moves)
      // If status is undefined, keep current status (for same-column moves)
      const updatedStatus = status !== undefined ? status : task.status;
      
      return tasksAPI.update(taskId, {
        title: task.title,
        description: task.description,
        status: updatedStatus,
        due_date: task.due_date || null,
        priority: task.priority || 'medium',
        prevPosition: prevPosition,
        nextPosition: nextPosition,
      });
    },
    onMutate: async ({ taskId, prevPosition, nextPosition, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', id] });
      const previousTasks = queryClient.getQueryData(['tasks', id]);
      
      // Calculate new position optimistically
      let newPosition;
      if (prevPosition === null && nextPosition === null) {
        newPosition = 10000;
      } else if (prevPosition === null) {
        newPosition = nextPosition / 2;
      } else if (nextPosition === null) {
        newPosition = prevPosition + 10000;
      } else {
        newPosition = (prevPosition + nextPosition) / 2;
      }
      
      queryClient.setQueryData(['tasks', id], (old) => {
        // Handle both array and paginated object formats
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = oldArray.map(t => {
          if (t.id === taskId) {
            const updated = { ...t, position: newPosition };
            // Always update status if provided (for cross-column moves)
            if (status !== undefined) {
              updated.status = status;
            }
            return updated;
          }
          return t;
        });
        
        // Return in same format as received
        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      console.error('Position update error:', err);
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', id], context.previousTasks);
      }
      // If status was being updated and position update failed, try status update as fallback
      if (variables.status !== undefined && variables.status !== tasks.find(t => t.id === variables.taskId)?.status) {
        const task = tasks.find(t => t.id === variables.taskId);
        if (task) {
          statusUpdateMutation.mutate({ taskId: variables.taskId, newStatus: variables.status, task });
        }
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

  const handlePositionChange = (taskId, prevPosition, nextPosition, status) => {
    positionUpdateMutation.mutate({ taskId, prevPosition, nextPosition, status });
  };

  const handleEditClick = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const handleTaskClick = (task) => {
    handleEditClick(task);
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
          <h2>Mission Control</h2>
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
          <div className="mission-control-grid">
            <aside className="mission-control-sidebar">
              <MiniCalendar
                tasks={tasks}
                onDateClick={handleDateClick}
                selectedDate={selectedDate}
              />
              <Timeline
                tasks={tasks}
                onTaskClick={handleTaskClick}
              />
            </aside>
            <div className="mission-control-main">
              <KanbanBoard
                tasks={tasks}
                onStatusChange={handleStatusChange}
                onPositionChange={handlePositionChange}
                onEdit={handleEditClick}
                onDelete={handleDeleteTask}
                selectedDate={selectedDate}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ProjectDetail;

