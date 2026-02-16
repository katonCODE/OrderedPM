// client/src/components/ProjectDetail.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsAPI, tasksAPI } from '../services/api';
import { exportProjectData } from '../utils/export';
import KanbanBoard from './KanbanBoard';
import MiniCalendar from './MiniCalendar';
import Timeline from './Timeline';
import TaskForm from './TaskForm';
import TaskCreationModal from './TaskCreationModal';
import AITaskForm from './AITaskForm';
import TaskView from './TaskView';
import GlobalTaskSearch from './GlobalTaskSearch';
import { ProjectDetailSkeleton } from './SkeletonLoader';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import './ProjectDetail.css';

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [showAITaskForm, setShowAITaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [sortByPriority, setSortByPriority] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [actionError, setActionError] = useState('');
  const exportMenuRef = useRef(null);
  const globalSearchRef = useRef(null);

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

  // Get all unique tags from tasks
  const allTags = useMemo(() => {
    const tagSet = new Set();
    tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Calculate filtered tasks count for search feedback
  const filteredTasksCount = useMemo(() => {
    let filtered = tasks;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task => {
        const titleMatch = task.title?.toLowerCase().includes(query);
        const descriptionMatch = task.description?.toLowerCase().includes(query);
        return titleMatch || descriptionMatch;
      });
    }
    if (selectedTag) {
      filtered = filtered.filter(task =>
        task.tags && Array.isArray(task.tags) && task.tags.includes(selectedTag)
      );
    }
    if (selectedPriority) {
      filtered = filtered.filter(task => task.priority === selectedPriority);
    }
    return filtered.length;
  }, [tasks, searchQuery, selectedTag, selectedPriority]);

  useEffect(() => {
    const openTaskId = location.state?.openTaskId;
    if (!openTaskId) return;
    setViewingTask({ id: openTaskId });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.openTaskId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const handleCreateTask = async (taskData) => {
    try {
      setActionError('');
      await tasksAPI.create(taskData);
      // Invalidate query to refetch with proper format (including subtasks)
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      setShowForm(false);
      setShowAITaskForm(false);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateTask = async (taskId, taskData) => {
    try {
      setActionError('');
      await tasksAPI.update(taskId, taskData);
      // Invalidate query to refetch with proper format (including subtasks)
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
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
      setActionError('');
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
        start_date: task.start_date || null,
        due_date: task.due_date || null,
        priority: task.priority || 'medium',
        estimated_minutes: task.estimated_minutes || null,
        tags: task.tags || [],
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
      setActionError(err?.message || 'Failed to update task status');
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
        start_date: task.start_date || null,
        due_date: task.due_date || null,
        priority: task.priority || 'medium',
        estimated_minutes: task.estimated_minutes || null,
        tags: task.tags || [],
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
      setActionError(err?.message || 'Failed to move task');
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
    setActionError('');
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      statusUpdateMutation.mutate({ taskId, newStatus, task });
    }
  };

  const handlePositionChange = (taskId, prevPosition, nextPosition, status) => {
    setActionError('');
    positionUpdateMutation.mutate({ taskId, prevPosition, nextPosition, status });
  };

  const handleEditClick = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setShowCreationModal(false);
    setShowAITaskForm(false);
    setEditingTask(null);
  };

  const handleNewTaskClick = () => {
    if (editingTask) {
      setShowForm(true);
    } else {
      setShowCreationModal(true);
    }
  };

  const handleSelectManual = () => {
    setShowCreationModal(false);
    setShowForm(true);
  };

  const handleSelectAI = () => {
    setShowCreationModal(false);
    setShowAITaskForm(true);
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  const handleTaskClick = async (task) => {
    // Fetch full task with subtasks
    try {
      const fullTask = await tasksAPI.getById(task.id);
      setViewingTask(fullTask);
    } catch (err) {
      console.error('Error fetching task:', err);
      // Fallback to the task we have
      setViewingTask(task);
    }
  };

  const handleViewTaskClose = () => {
    setViewingTask(null);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'c': () => {
      if (!showForm && !showAITaskForm && !showCreationModal && !viewingTask) {
        setShowCreationModal(true);
      }
    },
    '/': (e) => {
      e.preventDefault();
      if (globalSearchRef.current?.focus) {
        globalSearchRef.current.focus();
      }
    },
    'Escape': () => {
      if (viewingTask) {
        handleViewTaskClose();
      }
      if (showForm) {
        setShowForm(false);
        setEditingTask(null);
      }
      if (showAITaskForm) {
        setShowAITaskForm(false);
      }
      if (showCreationModal) {
        setShowCreationModal(false);
      }
    },
  }, [showForm, showAITaskForm, showCreationModal, viewingTask]);

  if (loading && !project) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-12">
          <ProjectDetailSkeleton />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center px-6">
        <p className="text-red-400 text-lg mb-6">Project not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0]">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative backdrop-blur-xl bg-white/5 border-b border-white/10 overflow-visible" style={{ zIndex: 1 }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 md:py-8 overflow-visible">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-2"
          >
            ← Back to Projects
          </button>
          <div className="mb-4 w-full max-w-md">
            <GlobalTaskSearch ref={globalSearchRef} />
          </div>
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold">
                  <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {project.name}
                  </span>
                </h1>
                {project.archived && (
                  <span className="px-3 py-1 bg-gray-500/20 border border-gray-500/30 rounded-lg text-xs text-gray-400 font-medium">
                    Archived
                  </span>
                )}
              </div>
              {project.description && (
                <p className="text-gray-400 text-base md:text-lg leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>
            {project && (
              <div className="relative z-[100]" ref={exportMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExportMenu(!showExportMenu);
                  }}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-[#e0e0e0] font-medium rounded-lg hover:bg-white/10 transition-all flex items-center gap-2"
                  title="Export project data"
                >
                  📥 Export
                </button>
                {showExportMenu && (
                  <div
                    className="absolute right-0 mt-2 w-48 bg-[#252525] border border-white/10 rounded-lg shadow-xl z-[200] overflow-visible"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', zIndex: 200 }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (project) {
                          exportProjectData(project, tasks || [], 'csv');
                          setShowExportMenu(false);
                        }
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full text-left px-4 py-2.5 text-sm text-[#e0e0e0] hover:bg-white/10 rounded-t-lg cursor-pointer relative z-[201] block"
                      style={{ position: 'relative', zIndex: 201, pointerEvents: 'auto' }}
                    >
                      Export as CSV
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (project) {
                          exportProjectData(project, tasks || [], 'json');
                          setShowExportMenu(false);
                        }
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-full text-left px-4 py-2.5 text-sm text-[#e0e0e0] hover:bg-white/10 rounded-b-lg cursor-pointer relative z-[201] block"
                      style={{ position: 'relative', zIndex: 201, pointerEvents: 'auto' }}
                    >
                      Export as JSON
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-0 max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#e0e0e0]">Mission Control</h2>
          <button
            onClick={handleNewTaskClick}
            className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20"
          >
            + New Task
          </button>
        </div>

        {(error || actionError) && (
          <div className="mb-6 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
            {error || actionError}
          </div>
        )}

        {showCreationModal && (
          <TaskCreationModal
            onSelectManual={handleSelectManual}
            onSelectAI={handleSelectAI}
            onClose={handleFormClose}
          />
        )}

        {showAITaskForm && (
          <AITaskForm
            projectId={id}
            onSubmit={handleCreateTask}
            onCancel={handleFormClose}
          />
        )}

        {showForm && (
          <TaskForm
            task={editingTask}
            projectId={id}
            onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
            onCancel={handleFormClose}
          />
        )}

        {viewingTask && (
          <TaskView
            task={viewingTask}
            onEdit={handleEditClick}
            onClose={handleViewTaskClose}
            onTaskUpdate={(updatedTask) => {
              setViewingTask(updatedTask);
            }}
          />
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading tasks...</div>
        ) : (
          <>
            {/* Search Bar */}
            <div className="sticky top-0 z-20 backdrop-blur-xl bg-[#1a1a1a]/80 border border-white/10 rounded-lg p-4 mb-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="flex-1 w-full">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search tasks by title or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                      />
                      {(searchQuery || selectedTag || selectedPriority) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {filteredTasksCount} {filteredTasksCount === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </div>
                  </div>
                  {allTags.length > 0 && (
                    <select
                      value={selectedTag || ''}
                      onChange={(e) => setSelectedTag(e.target.value || null)}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-yellow-500/50 min-w-[150px]"
                    >
                      <option value="">All Tags</option>
                      {allTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'high', 'medium', 'low'].map((priority) => (
                      <button
                        key={priority}
                        onClick={() => {
                          if (priority === 'all') {
                            setSelectedPriority(null);
                          } else {
                            setSelectedPriority(priority);
                          }
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${(priority === 'all' && !selectedPriority) || selectedPriority === priority
                          ? priority === 'all'
                            ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                            : priority === 'high'
                              ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                              : priority === 'medium'
                                ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                                : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                          }`}
                      >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSortByPriority(!sortByPriority)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sortByPriority
                      ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                      : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    title="Sort by priority (High → Medium → Low)"
                  >
                    {sortByPriority ? '✓ Sort by Priority' : 'Sort by Priority'}
                  </button>
                  {(searchQuery || selectedDate || selectedTag || selectedPriority) && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedDate(null);
                        setSelectedTag(null);
                        setSelectedPriority(null);
                        setSortByPriority(false);
                      }}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:bg-white/10 hover:text-[#e0e0e0] transition-all text-sm font-medium"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {selectedTag && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Tag:</span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-sm text-blue-300">
                        {selectedTag}
                        <button
                          onClick={() => setSelectedTag(null)}
                          className="hover:text-blue-200 transition-colors"
                          title="Remove tag filter"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  )}
                  {selectedPriority && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Priority:</span>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${selectedPriority === 'high'
                        ? 'bg-red-500/20 border-red-500/30 text-red-300'
                        : selectedPriority === 'medium'
                          ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
                          : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                        }`}>
                        {selectedPriority.charAt(0).toUpperCase() + selectedPriority.slice(1)}
                        <button
                          onClick={() => setSelectedPriority(null)}
                          className="hover:opacity-70 transition-opacity"
                          title="Remove priority filter"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  )}
                  {sortByPriority && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Sorted by:</span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-sm text-purple-300">
                        Priority
                        <button
                          onClick={() => setSortByPriority(false)}
                          className="hover:opacity-70 transition-opacity"
                          title="Remove priority sort"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
              <aside className="flex flex-col gap-6 h-fit lg:sticky lg:top-6 lg:max-h-[calc(100vh-120px)] overflow-y-auto">
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
              <div className="min-h-[600px]">
                <KanbanBoard
                  tasks={tasks}
                  onStatusChange={handleStatusChange}
                  onPositionChange={handlePositionChange}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteTask}
                  onTaskClick={handleTaskClick}
                  selectedDate={selectedDate}
                  searchQuery={searchQuery}
                  selectedTag={selectedTag}
                  selectedPriority={selectedPriority}
                  sortByPriority={sortByPriority}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default ProjectDetail;

