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
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import './Dashboard.css';
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
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [actionError, setActionError] = useState('');
  const [shareUsername, setShareUsername] = useState('');
  const [sharePermissionLevel, setSharePermissionLevel] = useState('editor');
  const [shareError, setShareError] = useState('');
  const [shareSuccess, setShareSuccess] = useState('');
  const [shareSearchTerm, setShareSearchTerm] = useState('');
  const [showShareSuggestions, setShowShareSuggestions] = useState(false);
  const [bulkShareInput, setBulkShareInput] = useState('');
  const [bulkSharePermissionLevel, setBulkSharePermissionLevel] = useState('editor');
  const [bulkShareSummary, setBulkShareSummary] = useState(null);
  const [shareLinkPermissionLevel, setShareLinkPermissionLevel] = useState('viewer');
  const [shareLinkExpiresAt, setShareLinkExpiresAt] = useState('');
  const [redeemShareLinkValue, setRedeemShareLinkValue] = useState('');
  const shareMenuRef = useRef(null);
  const exportMenuRef = useRef(null);
  const globalSearchRef = useRef(null);
  const shareAutocompleteRef = useRef(null);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsAPI.getById(id),
  });

  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksAPI.getByProject(id, { limit: 1000, offset: 0 }), // Large limit for Kanban view
  });
  const { data: sharesData, isLoading: sharesLoading } = useQuery({
    queryKey: ['projectShares', id],
    queryFn: () => projectsAPI.getShares(id),
    enabled: Boolean(project),
  });
  const { data: shareCandidatesData, isLoading: shareCandidatesLoading } = useQuery({
    queryKey: ['shareCandidates', id, shareSearchTerm],
    queryFn: () => projectsAPI.searchShareCandidates(id, shareSearchTerm),
    enabled: Boolean(project) && shareSearchTerm.length >= 2,
  });
  const { data: shareLinksData, isLoading: shareLinksLoading } = useQuery({
    queryKey: ['projectShareLinks', id],
    queryFn: () => projectsAPI.getShareLinks(id),
    enabled: Boolean(project),
  });

  useRealtimeSubscription('tasks', {
    filter: `project_id=eq.${id}`,
    queryKeys: [
      ['tasks', id],
      ['tasks', 'all'],
      ['tasks', 'today'],
    ],
    enabled: !!id,
  });

  useRealtimeSubscription('projects', {
    filter: `id=eq.${id}`,
    queryKeys: [
      ['project', id],
      ['projects'],
    ],
    enabled: !!id,
  });

  // Handle both old format (array) and new format (object with data and pagination)
  // For KanbanBoard, we need all tasks, so we use a large limit
  const tasks = tasksData?.data || tasksData || [];
  const shares = sharesData?.data || [];
  const shareCandidates = shareCandidatesData?.data || [];
  const shareLinks = shareLinksData?.data || [];
  const isOwner = project?.is_owner !== false;
  const permissionLevel = isOwner ? 'admin' : (project?.permission_level || 'viewer');
  const canManageTasks = isOwner || permissionLevel === 'editor' || permissionLevel === 'admin';
  const canDeleteTasks = isOwner || permissionLevel === 'admin';
  const canManageShares = isOwner || permissionLevel === 'admin';
  const canGrantAdmin = isOwner;
  const panelClass = 'dashboard-sketch-card dashboard-panel rounded-[18px]';
  const surfaceClass = 'bg-white/[0.035] border border-[rgba(222,209,175,0.12)] rounded-[14px]';
  const inputClass = 'dashboard-input px-4 py-2 text-sm';
  const selectClass = 'dashboard-select px-4 py-2 text-sm';
  const secondaryButtonClass = 'dashboard-secondary-button px-4';
  const dangerButtonClass = 'inline-flex items-center justify-center px-4 py-2 rounded-[12px] border border-red-400/20 bg-red-500/10 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/15 disabled:opacity-50';

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
    const timer = setTimeout(() => {
      setShareSearchTerm(shareUsername.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [shareUsername]);

  useEffect(() => {
    if (!showExportMenu && !showShareMenu) return;

    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShowShareMenu(false);
        setShowShareSuggestions(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
      if (shareAutocompleteRef.current && !shareAutocompleteRef.current.contains(event.target)) {
        setShowShareSuggestions(false);
      }
    };

    // Use capture phase for more reliable cleanup
    document.addEventListener('mousedown', handleClickOutside, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showExportMenu, showShareMenu]);

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
      // Cancel all related queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['tasks', id] });
      await queryClient.cancelQueries({ queryKey: ['task', taskId] });
      await queryClient.cancelQueries({ queryKey: ['task-activities', taskId] });

      // Get previous data for rollback
      const previousTasks = queryClient.getQueryData(['tasks', id]);
      const previousTask = queryClient.getQueryData(['task', taskId]);
      const previousActivities = queryClient.getQueryData(['task-activities', taskId]);

      // Handle both array and paginated object formats
      const tasksArray = Array.isArray(previousTasks)
        ? previousTasks
        : previousTasks?.data || [];

      const task = tasksArray.find(t => t.id === taskId);

      if (task) {
        // Update tasks list optimistically
        queryClient.setQueryData(['tasks', id], (old) => {
          const oldArray = Array.isArray(old) ? old : old?.data || [];
          const updatedArray = oldArray.map(t => t.id === taskId ? { ...t, status: newStatus } : t);

          if (Array.isArray(old)) {
            return updatedArray;
          } else if (old && typeof old === 'object' && 'data' in old) {
            return { ...old, data: updatedArray };
          }
          return updatedArray;
        });
      }

      // Update individual task query optimistically
      if (previousTask) {
        queryClient.setQueryData(['task', taskId], (old) => {
          if (!old) return old;
          return { ...old, status: newStatus };
        });
      }

      // Add optimistic activity feed entry
      if (previousTask && previousTask.status !== newStatus) {
        const activitiesArray = Array.isArray(previousActivities) ? previousActivities : previousActivities?.data || [];
        const optimisticActivity = {
          id: `temp-${Date.now()}`,
          task_id: taskId,
          user_id: null,
          activity_type: 'status_changed',
          old_value: previousTask.status,
          new_value: newStatus,
          created_at: new Date().toISOString(),
          user_username: null,
          user_full_name: null,
          user_avatar_url: null,
        };
        queryClient.setQueryData(['task-activities', taskId], (old) => {
          const oldArray = Array.isArray(old) ? old : old?.data || [];
          const updatedArray = [optimisticActivity, ...oldArray];
          if (Array.isArray(old)) {
            return updatedArray;
          } else if (old && typeof old === 'object' && 'data' in old) {
            return { ...old, data: updatedArray };
          }
          return updatedArray;
        });
      }

      return { previousTasks, previousTask, previousActivities };
    },
    onSuccess: (updatedTaskData, variables) => {
      // Update cache with server response instead of refetching
      queryClient.setQueryData(['tasks', id], (old) => {
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = oldArray.map(t =>
          t.id === variables.taskId ? { ...t, ...updatedTaskData } : t
        );
        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });

      // Update individual task query with server response
      queryClient.setQueryData(['task', variables.taskId], (old) => {
        if (!old) return old;
        return { ...old, ...updatedTaskData };
      });

      // Invalidate activity feed to get fresh data (server creates activity entry)
      queryClient.invalidateQueries({ queryKey: ['task-activities', variables.taskId] });
    },
    onError: (err, variables, context) => {
      // Rollback all optimistic updates
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', id], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', variables.taskId], context.previousTask);
      }
      if (context?.previousActivities) {
        queryClient.setQueryData(['task-activities', variables.taskId], context.previousActivities);
      }
      setActionError(err?.message || 'Failed to update task status');
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
      // Cancel all related queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['tasks', id] });
      await queryClient.cancelQueries({ queryKey: ['task', taskId] });
      await queryClient.cancelQueries({ queryKey: ['task-activities', taskId] });

      // Get previous data for rollback
      const previousTasks = queryClient.getQueryData(['tasks', id]);
      const previousTask = queryClient.getQueryData(['task', taskId]);
      const previousActivities = queryClient.getQueryData(['task-activities', taskId]);

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

      const updatedStatus = status !== undefined ? status : (previousTask?.status || tasks.find(t => t.id === taskId)?.status);

      // Update tasks list optimistically
      queryClient.setQueryData(['tasks', id], (old) => {
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = oldArray.map(t => {
          if (t.id === taskId) {
            const updated = { ...t, position: newPosition };
            if (status !== undefined) {
              updated.status = status;
            }
            return updated;
          }
          return t;
        });

        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });

      // Update individual task query optimistically
      if (previousTask) {
        queryClient.setQueryData(['task', taskId], (old) => {
          if (!old) return old;
          return {
            ...old,
            position: newPosition,
            ...(status !== undefined && { status }),
          };
        });
      }

      // Add optimistic activity feed entry if status changed
      if (status !== undefined && previousTask && previousTask.status !== status) {
        const activitiesArray = Array.isArray(previousActivities) ? previousActivities : previousActivities?.data || [];
        const optimisticActivity = {
          id: `temp-${Date.now()}`,
          task_id: taskId,
          user_id: null,
          activity_type: 'status_changed',
          old_value: previousTask.status,
          new_value: status,
          created_at: new Date().toISOString(),
          user_username: null,
          user_full_name: null,
          user_avatar_url: null,
        };
        queryClient.setQueryData(['task-activities', taskId], (old) => {
          const oldArray = Array.isArray(old) ? old : old?.data || [];
          const updatedArray = [optimisticActivity, ...oldArray];
          if (Array.isArray(old)) {
            return updatedArray;
          } else if (old && typeof old === 'object' && 'data' in old) {
            return { ...old, data: updatedArray };
          }
          return updatedArray;
        });
      }

      return { previousTasks, previousTask, previousActivities };
    },
    onSuccess: (updatedTaskData, variables) => {
      // Update cache with server response instead of refetching
      queryClient.setQueryData(['tasks', id], (old) => {
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = oldArray.map(t =>
          t.id === variables.taskId ? { ...t, ...updatedTaskData } : t
        );
        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });

      // Update individual task query with server response
      queryClient.setQueryData(['task', variables.taskId], (old) => {
        if (!old) return old;
        return { ...old, ...updatedTaskData };
      });

      // Invalidate activity feed to get fresh data (server creates activity entry)
      queryClient.invalidateQueries({ queryKey: ['task-activities', variables.taskId] });
    },
    onError: (err, variables, context) => {
      console.error('Position update error:', err);
      // Rollback all optimistic updates
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', id], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', variables.taskId], context.previousTask);
      }
      if (context?.previousActivities) {
        queryClient.setQueryData(['task-activities', variables.taskId], context.previousActivities);
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
  });

  const addShareMutation = useMutation({
    mutationFn: ({ username, permissionLevel }) => projectsAPI.shareWithUsername(id, username, permissionLevel),
    onSuccess: () => {
      setShareUsername('');
      setSharePermissionLevel('editor');
      setShareError('');
      setShareSuccess('Project shared successfully.');
      queryClient.invalidateQueries({ queryKey: ['projectShares', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to share project');
    },
  });

  const removeShareMutation = useMutation({
    mutationFn: (sharedUserId) => projectsAPI.removeShare(id, sharedUserId),
    onSuccess: () => {
      setShareError('');
      setShareSuccess('Share removed.');
      queryClient.invalidateQueries({ queryKey: ['projectShares', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to remove share');
    },
  });

  const updateSharePermissionMutation = useMutation({
    mutationFn: ({ sharedUserId, permissionLevel: nextPermissionLevel }) =>
      projectsAPI.updateSharePermission(id, sharedUserId, nextPermissionLevel),
    onSuccess: () => {
      setShareError('');
      setShareSuccess('Permission updated.');
      queryClient.invalidateQueries({ queryKey: ['projectShares', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to update permission');
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: (newOwnerUserId) => projectsAPI.transferOwnership(id, newOwnerUserId),
    onSuccess: () => {
      setShareError('');
      setShareSuccess('Ownership transferred. You are now an admin collaborator.');
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projectShares', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to transfer ownership');
    },
  });

  const leaveProjectMutation = useMutation({
    mutationFn: () => projectsAPI.leave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      navigate('/dashboard');
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to leave project');
    },
  });

  const bulkShareMutation = useMutation({
    mutationFn: ({ identifiers, permissionLevel }) => projectsAPI.bulkShare(id, identifiers, permissionLevel),
    onSuccess: (response) => {
      const summary = response?.data?.summary || null;
      setBulkShareSummary(summary);
      setShareError('');
      setShareSuccess(summary ? `Bulk share complete: ${summary.shared} shared, ${summary.failed} failed.` : 'Bulk share complete.');
      setBulkShareInput('');
      queryClient.invalidateQueries({ queryKey: ['projectShares', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to bulk share');
    },
  });

  const createShareLinkMutation = useMutation({
    mutationFn: ({ permissionLevel, expiresAt }) => projectsAPI.createShareLink(id, {
      permission_level: permissionLevel,
      expires_at: expiresAt || null,
    }),
    onSuccess: () => {
      setShareError('');
      setShareSuccess('Share link created.');
      queryClient.invalidateQueries({ queryKey: ['projectShareLinks', id] });
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to create share link');
    },
  });

  const revokeShareLinkMutation = useMutation({
    mutationFn: (linkId) => projectsAPI.revokeShareLink(id, linkId),
    onSuccess: () => {
      setShareError('');
      setShareSuccess('Share link revoked.');
      queryClient.invalidateQueries({ queryKey: ['projectShareLinks', id] });
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to revoke share link');
    },
  });

  const redeemShareLinkMutation = useMutation({
    mutationFn: (token) => projectsAPI.redeemShareLink(token),
    onSuccess: (result) => {
      setShareError('');
      setShareSuccess('Share link redeemed. Redirecting...');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      const projectId = result?.project_id;
      if (projectId) {
        navigate(`/project/${projectId}`);
      }
    },
    onError: (err) => {
      setShareSuccess('');
      setShareError(err?.message || 'Failed to redeem share link');
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
    if (!canManageTasks) return;
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
    if (!canManageTasks) return;
    if (editingTask) {
      setShowForm(true);
    } else {
      setShowCreationModal(true);
    }
  };

  const handleSelectManual = () => {
    if (!canManageTasks) return;
    setShowCreationModal(false);
    setShowForm(true);
  };

  const handleSelectAI = () => {
    if (!canManageTasks) return;
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

  const handleShareProject = () => {
    if (!canManageShares) {
      setShareSuccess('');
      setShareError('You do not have permission to share this project');
      return;
    }
    const identifier = shareUsername.trim();
    if (!identifier) {
      setShareSuccess('');
      setShareError('Enter a username or email to share with');
      return;
    }
    addShareMutation.mutate({ username: identifier, permissionLevel: sharePermissionLevel });
    setShowShareSuggestions(false);
  };

  const handleSharePermissionChange = (share, nextPermissionLevel) => {
    if (!share || !share.user_id) return;
    if (share.permission_level === nextPermissionLevel) return;
    updateSharePermissionMutation.mutate({
      sharedUserId: share.user_id,
      permissionLevel: nextPermissionLevel
    });
  };

  const handleTransferOwnership = (share) => {
    if (!isOwner || !share?.user_id) return;
    const confirmed = window.confirm(
      `Transfer project ownership to ${share.full_name || share.username}? You will become an admin collaborator.`
    );
    if (!confirmed) return;
    transferOwnershipMutation.mutate(share.user_id);
  };

  const handleShareCandidateSelect = (candidate) => {
    setShareUsername(candidate.username || '');
    setShareSearchTerm(candidate.username || '');
    setShowShareSuggestions(false);
    setShareError('');
    setShareSuccess('');
  };

  const parseShareIdentifiers = (value) => {
    return [...new Set(
      String(value || '')
        .split(/[\n,;\t]/g)
        .map((part) => part.trim())
        .filter(Boolean)
    )];
  };

  const parseShareToken = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/\/share-links\/([a-f0-9]+)\/redeem/i);
    if (match?.[1]) return match[1];
    return raw;
  };

  const handleBulkShare = () => {
    const identifiers = parseShareIdentifiers(bulkShareInput);
    if (identifiers.length === 0) {
      setShareSuccess('');
      setShareError('Add at least one username or email for bulk sharing');
      return;
    }
    setBulkShareSummary(null);
    bulkShareMutation.mutate({
      identifiers,
      permissionLevel: bulkSharePermissionLevel
    });
  };

  const handleBulkShareCSVImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setBulkShareInput((prev) => `${prev}\n${text}`.trim());
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleCreateShareLink = () => {
    createShareLinkMutation.mutate({
      permissionLevel: shareLinkPermissionLevel,
      expiresAt: shareLinkExpiresAt || null
    });
  };

  const handleCopyShareLink = async (token) => {
    const link = `${window.location.origin}/share-links/${token}/redeem`;
    try {
      await navigator.clipboard.writeText(link);
      setShareSuccess('Share link copied.');
      setShareError('');
    } catch (error) {
      setShareError('Failed to copy link');
      setShareSuccess('');
    }
  };

  const handleRedeemShareLink = () => {
    const token = parseShareToken(redeemShareLinkValue);
    if (!token) {
      setShareSuccess('');
      setShareError('Enter a share token or full share URL');
      return;
    }
    redeemShareLinkMutation.mutate(token);
  };

  const handleLeaveProject = () => {
    if (isOwner) return;
    const confirmed = window.confirm('Leave this shared project? You will lose access immediately.');
    if (!confirmed) return;
    leaveProjectMutation.mutate();
  };

  const sharePanelContent = (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className={`${panelClass} p-4`}>
        {!isOwner && (
          <div className="mb-3">
            <button
              onClick={handleLeaveProject}
              disabled={leaveProjectMutation.isPending}
              className={dangerButtonClass}
            >
              {leaveProjectMutation.isPending ? 'Leaving...' : 'Leave Project'}
            </button>
          </div>
        )}
        {canManageShares ? (
          <>
            <p className="text-xs text-[#8f8779] mb-2">
              {isOwner ? 'Share with username or email' : 'Share with username or email (viewer/editor only)'}
            </p>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1" ref={shareAutocompleteRef}>
                <input
                  value={shareUsername}
                  onChange={(e) => {
                    setShareUsername(e.target.value);
                    setShareError('');
                    setShareSuccess('');
                    setShowShareSuggestions(true);
                  }}
                  onFocus={() => setShowShareSuggestions(true)}
                  placeholder="username or email"
                  className={`w-full ${inputClass}`}
                />
                {showShareSuggestions && shareSearchTerm.length >= 2 && (
                  <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-[14px] border border-[rgba(222,209,175,0.12)] bg-[#1b1b1b] shadow-xl">
                    {shareCandidatesLoading ? (
                      <p className="px-3 py-2 text-xs text-[#8f8779]">Searching users...</p>
                    ) : shareCandidates.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-[#8f8779]">No matching users</p>
                    ) : (
                      shareCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleShareCandidateSelect(candidate)}
                          className="w-full px-3 py-2 text-left transition-colors hover:bg-white/5"
                        >
                          <p className="text-sm text-[#efe5cf]">{candidate.full_name || candidate.username}</p>
                          <p className="text-xs text-[#8f8779]">@{candidate.username}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <select
                value={sharePermissionLevel}
                onChange={(e) => {
                  setSharePermissionLevel(e.target.value);
                  setShareError('');
                  setShareSuccess('');
                }}
                className={selectClass}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                {canGrantAdmin && <option value="admin">Admin</option>}
              </select>
              <button
                onClick={handleShareProject}
                disabled={addShareMutation.isPending}
                className={secondaryButtonClass}
              >
                {addShareMutation.isPending ? 'Sharing...' : 'Share'}
              </button>
            </div>
            <p className="text-xs text-[#8f8779] mb-3">
              Viewer: Read-only • Editor: Create/Edit tasks • Admin: Full access
            </p>
          </>
        ) : (
          <p className="text-xs text-[#b9ae99]">
            {permissionLevel === 'viewer'
              ? 'Read-only access: you can view tasks and task details.'
              : permissionLevel === 'editor'
                ? 'Editor access: you can create, edit, and move tasks.'
                : 'Admin access: you can create, edit, move, and delete tasks.'}
          </p>
        )}
        {shareError && <p className="text-xs text-red-300 mt-2">{shareError}</p>}
        {shareSuccess && <p className="text-xs text-emerald-300 mt-2">{shareSuccess}</p>}
        {!canManageShares && (
          <div className="mt-3 pt-3 border-t border-[#d4af37]/10">
            <p className="text-xs text-[#8f8779] mb-2">Join shared project by link</p>
            <div className="flex gap-2">
              <input
                value={redeemShareLinkValue}
                onChange={(e) => setRedeemShareLinkValue(e.target.value)}
                placeholder="Paste share URL or token"
                className={`flex-1 ${inputClass}`}
              />
              <button
                onClick={handleRedeemShareLink}
                disabled={redeemShareLinkMutation.isPending}
                className={secondaryButtonClass}
              >
                {redeemShareLinkMutation.isPending ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-[#d4af37]/10">
          <p className="text-xs text-[#8f8779] mb-2">Collaborators ({shares.length})</p>
          {sharesLoading ? (
            <p className="text-xs text-[#8f8779]">Loading...</p>
          ) : shares.length === 0 ? (
            <p className="text-xs text-[#8f8779]">No collaborators yet.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {shares.map((share) => {
                const targetIsAdmin = share.permission_level === 'admin';
                const canEditThisShare = canManageShares && (isOwner || !targetIsAdmin);
                const canRemoveThisShare = canManageShares && (isOwner || !targetIsAdmin);
                const canTransferToThisShare = isOwner;
                return (
                  <div key={share.user_id} className={`flex items-center justify-between gap-2 p-2 text-xs text-[#d1c5af] ${surfaceClass}`}>
                    <div className="flex items-center gap-2">
                      <span>{share.full_name || share.username}</span>
                      {canEditThisShare ? (
                        <select
                          value={share.permission_level || 'viewer'}
                          onChange={(e) => handleSharePermissionChange(share, e.target.value)}
                          disabled={updateSharePermissionMutation.isPending}
                          className="rounded-md border border-[rgba(222,209,175,0.12)] bg-white/[0.03] px-2 py-1 text-[10px] capitalize text-[#d1c5af] focus:outline-none"
                        >
                          <option value="viewer">viewer</option>
                          <option value="editor">editor</option>
                          {isOwner && <option value="admin">admin</option>}
                        </select>
                      ) : (
                        share.permission_level && (
                          <span className="rounded-md border border-[rgba(222,209,175,0.12)] bg-white/[0.03] px-2 py-1 text-[10px] capitalize text-[#8f8779]">
                            {share.permission_level}
                          </span>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canTransferToThisShare && (
                        <button
                          onClick={() => handleTransferOwnership(share)}
                          disabled={transferOwnershipMutation.isPending}
                          className="text-[#f0d792] hover:text-[#f7e3a8] disabled:opacity-50"
                        >
                          Make owner
                        </button>
                      )}
                      {canRemoveThisShare && (
                        <button
                          onClick={() => removeShareMutation.mutate(share.user_id)}
                          disabled={removeShareMutation.isPending}
                          className="text-red-300 hover:text-red-200 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {canManageShares && (
        <div className={`${panelClass} p-4`}>
          <div className="mb-3">
            <p className="text-xs text-[#8f8779] mb-2">Bulk share (paste list or import CSV)</p>
            <textarea
              value={bulkShareInput}
              onChange={(e) => setBulkShareInput(e.target.value)}
              rows={3}
              placeholder="alice,bob@example.com&#10;charlie"
              className={`w-full ${inputClass} min-h-24 resize-y`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={bulkSharePermissionLevel}
                onChange={(e) => setBulkSharePermissionLevel(e.target.value)}
                className={selectClass}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                {canGrantAdmin && <option value="admin">Admin</option>}
              </select>
              <label className={`${secondaryButtonClass} cursor-pointer text-[#ebe1cf]`}>
                Import CSV
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleBulkShareCSVImport} />
              </label>
              <button
                onClick={handleBulkShare}
                disabled={bulkShareMutation.isPending}
                className={secondaryButtonClass}
              >
                {bulkShareMutation.isPending ? 'Sharing...' : 'Share All'}
              </button>
            </div>
            {bulkShareSummary && (
              <p className="text-xs text-[#8f8779] mt-2">
                Processed {bulkShareSummary.total}: {bulkShareSummary.shared} shared, {bulkShareSummary.failed} failed
              </p>
            )}
          </div>
          <div className="pt-3 border-t border-[#d4af37]/10">
            <p className="text-xs text-[#8f8779] mb-2">Share links</p>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <select
                value={shareLinkPermissionLevel}
                onChange={(e) => setShareLinkPermissionLevel(e.target.value)}
                className={selectClass}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                {canGrantAdmin && <option value="admin">Admin</option>}
              </select>
              <input
                type="datetime-local"
                value={shareLinkExpiresAt}
                onChange={(e) => setShareLinkExpiresAt(e.target.value)}
                className={inputClass}
              />
              <button
                onClick={handleCreateShareLink}
                disabled={createShareLinkMutation.isPending}
                className={secondaryButtonClass}
              >
                {createShareLinkMutation.isPending ? 'Generating...' : 'Generate Link'}
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {shareLinksLoading ? (
                <p className="text-xs text-[#8f8779]">Loading links...</p>
              ) : shareLinks.length === 0 ? (
                <p className="text-xs text-[#8f8779]">No share links yet.</p>
              ) : (
                shareLinks.map((link) => (
                  <div key={link.id} className={`flex items-center justify-between gap-2 p-2 text-xs text-[#d1c5af] ${surfaceClass}`}>
                    <span className="truncate text-[#b9ae99]">
                      {link.permission_level} {link.expires_at ? `• expires ${new Date(link.expires_at).toLocaleString()}` : '• no expiry'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleCopyShareLink(link.token)} className="text-[#f0d792] hover:text-[#f7e3a8]">
                        Copy
                      </button>
                      {!link.revoked_at && (
                        <button
                          onClick={() => revokeShareLinkMutation.mutate(link.id)}
                          className="text-red-300 hover:text-red-200"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'c': () => {
      if (canManageTasks && !showForm && !showAITaskForm && !showCreationModal && !viewingTask) {
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
  }, [canManageTasks, showForm, showAITaskForm, showCreationModal, viewingTask]);

  if (loading && !project) {
    return (
      <div className="dashboard-shell min-h-screen text-[#efe5cf]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-12">
          <ProjectDetailSkeleton />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="dashboard-shell min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-red-300 text-lg mb-6">Project not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="dashboard-primary-button"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-shell min-h-screen text-[#efe5cf]">
      {/* Header */}
      <header className="dashboard-header-shell relative overflow-visible" style={{ zIndex: 1 }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 md:py-8 overflow-visible">
          <button
            onClick={() => navigate('/dashboard')}
            className="dashboard-ghost-link dashboard-geometric mb-4 inline-flex items-center gap-2 text-sm font-medium"
          >
            ← Back to Projects
          </button>
          <div className="mb-4 w-full max-w-md">
            <GlobalTaskSearch ref={globalSearchRef} />
          </div>
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="dashboard-geometric text-3xl md:text-4xl font-bold text-[#d4af37]">
                  {project.name}
                </h1>
                {project.archived && (
                  <span className="dashboard-pill dashboard-pill--archived">
                    Archived
                  </span>
                )}
                {!isOwner && (
                  <span className="dashboard-pill dashboard-pill--shared">
                    Shared with you
                  </span>
                )}
              </div>
              {project.description && (
                <p className="text-[#b9ae99] text-base md:text-lg leading-relaxed max-w-3xl">
                  {project.description}
                </p>
              )}
            </div>
            {project && (
              <div className="relative z-[100] flex items-start gap-2">
                <div className="relative" ref={shareMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExportMenu(false);
                      setShowShareMenu(!showShareMenu);
                    }}
                    className={secondaryButtonClass}
                    title="Share project"
                  >
                    Share
                  </button>
                  {showShareMenu && (
                    <div
                      className="absolute right-0 z-[200] mt-2 w-[min(90vw,56rem)] rounded-[18px] border border-[rgba(214,190,119,0.14)] bg-[#171717] p-4 shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {sharePanelContent}
                    </div>
                  )}
                </div>
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowShareMenu(false);
                      setShowExportMenu(!showExportMenu);
                    }}
                    className={`${secondaryButtonClass} flex items-center gap-2`}
                    title="Export project data"
                  >
                    📥 Export
                  </button>
                  {showExportMenu && (
                    <div
                      className="absolute right-0 z-[200] mt-2 w-48 overflow-visible rounded-[14px] border border-[rgba(214,190,119,0.14)] bg-[#171717] shadow-xl"
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
                        className="relative z-[201] block w-full cursor-pointer rounded-t-[14px] px-4 py-2.5 text-left text-sm text-[#efe5cf] hover:bg-white/5"
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
                        className="relative z-[201] block w-full cursor-pointer rounded-b-[14px] px-4 py-2.5 text-left text-sm text-[#efe5cf] hover:bg-white/5"
                        style={{ position: 'relative', zIndex: 201, pointerEvents: 'auto' }}
                      >
                        Export as JSON
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-0 mx-auto w-full max-w-[1600px] px-6 md:px-10 xl:px-12 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h2 className="dashboard-section-title-text text-2xl md:text-3xl">Mission Control</h2>
          {canManageTasks && (
            <button
              onClick={handleNewTaskClick}
              className="dashboard-primary-button"
            >
              + New Task
            </button>
          )}
        </div>

        {(error || actionError) && (
          <div className="dashboard-alert dashboard-alert--error mb-6">
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
            canManageTasks={canManageTasks}
            canDeleteTasks={canDeleteTasks}
            onTaskUpdate={(updatedTask) => {
              setViewingTask(updatedTask);
            }}
          />
        )}

        {loading ? (
          <div className="text-center py-20 text-[#8f8779]">Loading tasks...</div>
        ) : (
          <>
            {/* Search Bar */}
            <div className="mb-6 p-2">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="flex-1 w-full">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search tasks by title or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="dashboard-input w-full px-4 py-2"
                      />
                      {(searchQuery || selectedTag || selectedPriority) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8f8779]">
                          {filteredTasksCount} {filteredTasksCount === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </div>
                  </div>
                  {allTags.length > 0 && (
                    <select
                      value={selectedTag || ''}
                      onChange={(e) => setSelectedTag(e.target.value || null)}
                      className="dashboard-select min-w-[150px] px-4 py-2"
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
                        className={`dashboard-chip min-h-0 px-4 py-2 text-sm ${(priority === 'all' && !selectedPriority) || selectedPriority === priority
                          ? priority === 'all'
                            ? 'dashboard-chip-active'
                            : priority === 'high'
                              ? 'border-red-400/20 bg-red-500/10 text-red-300'
                              : priority === 'medium'
                                ? 'dashboard-chip-active'
                                : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                          : ''
                          }`}
                      >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSortByPriority(!sortByPriority)}
                    className={`dashboard-chip min-h-0 px-4 py-2 text-sm ${sortByPriority
                      ? 'dashboard-chip-active'
                      : ''
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
                      className="dashboard-chip min-h-0 px-4 py-2 text-sm"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {selectedTag && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#8f8779]">Tag:</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#d4af37]/20 bg-[#d4af37]/10 px-3 py-1 text-sm text-[#f0d792]">
                        {selectedTag}
                        <button
                          onClick={() => setSelectedTag(null)}
                          className="transition-colors hover:text-[#f7e3a8]"
                          title="Remove tag filter"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  )}
                  {selectedPriority && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#8f8779]">Priority:</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium border ${selectedPriority === 'high'
                        ? 'bg-red-500/10 border-red-400/20 text-red-300'
                        : selectedPriority === 'medium'
                          ? 'bg-[#d4af37]/10 border-[#d4af37]/20 text-[#f0d792]'
                          : 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
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
                      <span className="text-sm text-[#8f8779]">Sorted by:</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#d4af37]/20 bg-[#d4af37]/10 px-3 py-1 text-sm text-[#f0d792]">
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
            <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 xl:gap-6">
              <aside className="flex flex-col gap-6 h-fit overflow-x-hidden lg:sticky lg:top-6">
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
              <div className="min-h-[600px] w-full">
                <KanbanBoard
                  tasks={tasks}
                  onStatusChange={handleStatusChange}
                  onPositionChange={handlePositionChange}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteTask}
                  onTaskClick={handleTaskClick}
                  canEdit={canManageTasks}
                  canDelete={canDeleteTasks}
                  canReorder={canManageTasks}
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

