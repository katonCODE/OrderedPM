// client/src/components/Dashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsAPI, tasksAPI } from '../services/api';
import { getMyProfile } from '../services/profile';
import { exportAllData } from '../utils/export';
import { parseJSONFile, parseCSVFile, extractProjectsFromJSON, extractProjectsFromCSV, extractTasksFromJSON, extractTasksFromCSV, validateProjectData, validateTaskData } from '../utils/import';
import ProjectList from './ProjectList';
import ProjectForm from './ProjectForm';
import ConfirmDialog from './ConfirmDialog';
import Pagination from './Pagination';
import GlobalTaskSearch from './GlobalTaskSearch';
import QuickAddTaskForm from './QuickAddTaskForm';
import { ProjectCardSkeleton, StatsSkeleton } from './SkeletonLoader';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import './Dashboard.css';

function Dashboard({ onLogout }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, projectId: null });
  const [archiveConfirm, setArchiveConfirm] = useState({ isOpen: false, projectId: null });
  const [restoreConfirm, setRestoreConfirm] = useState({ isOpen: false, projectId: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState('projects');
  const [showQuickAddForm, setShowQuickAddForm] = useState(false);
  const [todayPlanTimeBudget, setTodayPlanTimeBudget] = useState(120);
  const [todayPlanPinnedTaskIds, setTodayPlanPinnedTaskIds] = useState([]);
  const [todayPlanPreview, setTodayPlanPreview] = useState(null);
  const [todayPlanLoading, setTodayPlanLoading] = useState(false);
  const [todayPlanSaving, setTodayPlanSaving] = useState(false);
  const [todayPlanError, setTodayPlanError] = useState('');
  const [todayPlanSuccess, setTodayPlanSuccess] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [shareLinkInput, setShareLinkInput] = useState('');
  const [joiningShareLink, setJoiningShareLink] = useState(false);
  const searchInputRef = useRef(null);
  const globalSearchRef = useRef(null);
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
    queryKey: ['projects', showArchived],
    queryFn: () => projectsAPI.getAll({
      limit: 1000,
      offset: 0,
      includeCount: false,
      includeArchived: showArchived
    }),
    placeholderData: (previousData) => previousData,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => tasksAPI.getAllForUser(),
    placeholderData: (previousData) => previousData,
  });

  const { data: allProjectsData } = useQuery({
    queryKey: ['projects', 'all-for-dashboard'],
    queryFn: () => projectsAPI.getAll({
      limit: 1000,
      offset: 0,
      includeCount: false,
      includeArchived: true
    }),
    placeholderData: (previousData) => previousData,
  });

  const { data: todayTasksData, refetch: refetchTodayTasks } = useQuery({
    queryKey: ['tasks', 'today'],
    queryFn: () => tasksAPI.getToday(),
    placeholderData: (previousData) => previousData,
  });

  useRealtimeSubscription('projects', {
    queryKeys: [
      ['projects', showArchived],
      ['projects', 'all-for-dashboard'],
    ],
  });

  useRealtimeSubscription('tasks', {
    queryKeys: [
      ['tasks', 'all'],
      ['tasks', 'today'],
    ],
  });

  const allProjects = projectsData?.data || projectsData || [];
  const allTasks = tasksData?.data || [];
  const allProjectsWithArchived = allProjectsData?.data || allProjectsData || [];
  const todaySavedTasks = todayTasksData?.data || [];
  const activeProjectsForQuickAdd = useMemo(
    () => allProjectsWithArchived.filter(project => !project.archived),
    [allProjectsWithArchived]
  );
  const projectNameById = useMemo(
    () => new Map(allProjectsWithArchived.map(project => [project.id, project.name])),
    [allProjectsWithArchived]
  );

  const error = queryError?.message || '';

  const stats = useMemo(() => {
    // Only count non-archived projects in stats
    const activeProjects = allProjects.filter(p => !p.archived);
    const totalProjects = showArchived ? allProjects.length : activeProjects.length;

    // Only count tasks from non-archived projects
    const activeProjectIds = new Set(activeProjects.map(p => p.id));
    const activeTasks = allTasks.filter(t =>
      activeProjectIds.has(t.project_id) && (t.status === 'todo' || t.status === 'in_progress')
    ).length;
    const overdueTasks = allTasks.filter(t => {
      if (!t.due_date || t.status === 'done' || !activeProjectIds.has(t.project_id)) return false;
      return new Date(t.due_date) < new Date();
    }).length;
    const doneTasks = allTasks.filter(t =>
      activeProjectIds.has(t.project_id) && t.status === 'done'
    ).length;
    const relevantTasks = allTasks.filter(t => activeProjectIds.has(t.project_id));
    const completionRate = relevantTasks.length > 0
      ? Math.round((doneTasks / relevantTasks.length) * 100)
      : 0;

    return {
      totalProjects,
      activeTasks,
      overdueTasks,
      completionRate
    };
  }, [allProjects, allTasks, showArchived]);

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...allProjects];

    // Filter by archived status based on showArchived state
    if (!showArchived) {
      filtered = filtered.filter(p => !p.archived);
    } else {
      filtered = filtered.filter(p => p.archived);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    if (filter === 'owned') {
      filtered = filtered.filter(p => p.is_owner !== false);
    } else if (filter === 'shared') {
      filtered = filtered.filter(p => p.is_owner === false);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created_old':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'created_new':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'updated':
          return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
        case 'tasks':
          const aTaskCount = allTasks.filter(t => t.project_id === a.id).length;
          const bTaskCount = allTasks.filter(t => t.project_id === b.id).length;
          return bTaskCount - aTaskCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [allProjects, allTasks, searchQuery, filter, sortBy]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProjects.slice(start, start + itemsPerPage);
  }, [filteredAndSortedProjects, currentPage]);

  const groupedProjects = useMemo(() => {
    const owned = paginatedProjects.filter((project) => project.is_owner !== false);
    const shared = paginatedProjects.filter((project) => project.is_owner === false);
    return {
      owned,
      sharedAdmin: shared.filter((project) => project.permission_level === 'admin'),
      sharedEditor: shared.filter((project) => project.permission_level === 'editor'),
      sharedViewer: shared.filter((project) => project.permission_level === 'viewer'),
    };
  }, [paginatedProjects]);

  const totalPages = Math.ceil(filteredAndSortedProjects.length / itemsPerPage);
  const todayString = new Date().toISOString().slice(0, 10);
  const upcomingDueSoonTasks = useMemo(() => {
    const activeProjectIds = new Set(activeProjectsForQuickAdd.map(project => project.id));
    return allTasks
      .filter(task =>
        !task.parent_task_id &&
        task.status !== 'done' &&
        task.due_date &&
        activeProjectIds.has(task.project_id) &&
        String(task.due_date).slice(0, 10) >= todayString
      )
      .sort((a, b) => String(a.due_date).slice(0, 10).localeCompare(String(b.due_date).slice(0, 10)))
      .slice(0, 5);
  }, [allTasks, activeProjectsForQuickAdd, todayString]);

  const hasCompletableTasks = useMemo(() => {
    const activeProjectIds = new Set(activeProjectsForQuickAdd.map(project => project.id));
    return allTasks.some(task =>
      !task.parent_task_id &&
      task.status !== 'done' &&
      activeProjectIds.has(task.project_id)
    );
  }, [allTasks, activeProjectsForQuickAdd]);
  const toggleTodayPin = (taskId) => {
    setTodayPlanPinnedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const getPlanReasonLabel = (reason) => {
    if (reason === 'pinned') return 'Pinned';
    if (reason === 'best_fit') return 'Best fit';
    if (reason === 'over_budget') return 'Over budget';
    return 'Auto plan';
  };

  const handleGenerateTodayPlan = async ({ save } = { save: false }) => {
    const budget = Math.max(1, Number(todayPlanTimeBudget) || 120);
    setTodayPlanError('');
    setTodayPlanSuccess('');
    if (save) {
      setTodayPlanSaving(true);
    } else {
      setTodayPlanLoading(true);
    }

    try {
      const response = await tasksAPI.generateTodayPlan({
        time_budget_minutes: budget,
        pinned_task_ids: todayPlanPinnedTaskIds,
        save,
      });
      setTodayPlanPreview(response?.data || null);

      if (save) {
        setTodayPlanSuccess('Today plan saved.');
        queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
        queryClient.invalidateQueries({ queryKey: ['tasks', 'today'] });
        await refetchTodayTasks();
      }
    } catch (err) {
      setTodayPlanError(err.message || 'Failed to generate today plan');
    } finally {
      setTodayPlanLoading(false);
      setTodayPlanSaving(false);
    }
  };

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (activeTab === 'today' && !hasCompletableTasks) {
      setActiveTab('projects');
    }
  }, [activeTab, hasCompletableTasks]);

  const handleCreateProject = async (projectData) => {
    try {
      const newProject = await projectsAPI.create(projectData);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      setShowForm(false);
      setCurrentPage(1);
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateProject = async (id, projectData) => {
    try {
      const updatedProject = await projectsAPI.update(id, projectData);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
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
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      setDeleteConfirm({ isOpen: false, projectId: null });
      if (paginatedProjects.length === 1 && currentPage > 1) {
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

  const handleArchiveClick = (id) => {
    setArchiveConfirm({ isOpen: true, projectId: id });
  };

  const handleArchiveConfirm = async () => {
    const { projectId } = archiveConfirm;
    if (!projectId) return;

    try {
      await projectsAPI.archive(projectId);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      setArchiveConfirm({ isOpen: false, projectId: null });
      if (paginatedProjects.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (err) {
      setArchiveConfirm({ isOpen: false, projectId: null });
    }
  };

  const handleArchiveCancel = () => {
    setArchiveConfirm({ isOpen: false, projectId: null });
  };

  const handleRestoreClick = (id) => {
    setRestoreConfirm({ isOpen: true, projectId: id });
  };

  const handleRestoreConfirm = async () => {
    const { projectId } = restoreConfirm;
    if (!projectId) return;

    try {
      await projectsAPI.unarchive(projectId);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      setRestoreConfirm({ isOpen: false, projectId: null });
    } catch (err) {
      setRestoreConfirm({ isOpen: false, projectId: null });
    }
  };

  const handleRestoreCancel = () => {
    setRestoreConfirm({ isOpen: false, projectId: null });
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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'c': () => {
      if (!showForm && !showQuickAddForm) {
        setShowQuickAddForm(true);
      }
    },
    '/': (e) => {
      e.preventDefault();
      if (globalSearchRef.current?.focus) {
        globalSearchRef.current.focus();
      }
    },
    'Escape': () => {
      if (showForm) {
        handleFormClose();
      }
      if (showQuickAddForm) {
        setShowQuickAddForm(false);
      }
    },
  }, [showForm, showQuickAddForm]);

  const handleImportFile = async (file) => {
    setImporting(true);
    setImportError('');
    setImportSuccess('');

    try {
      const isJSON = file.name.endsWith('.json');
      const isCSV = file.name.endsWith('.csv');

      if (!isJSON && !isCSV) {
        throw new Error('Please select a JSON or CSV file');
      }

      let projects = [];
      let tasksData = null;

      if (isJSON) {
        const data = await parseJSONFile(file);
        projects = extractProjectsFromJSON(data);
        tasksData = data;
      } else {
        const csvData = await parseCSVFile(file);
        const hasProjectColumns = csvData.headers.some(h =>
          h.toLowerCase().includes('project name') || h.toLowerCase() === 'name'
        );

        if (hasProjectColumns) {
          projects = extractProjectsFromCSV(csvData);
        } else {
          throw new Error('CSV file must contain project data. Please import a projects CSV file, or use JSON format which includes both projects and tasks.');
        }
      }

      if (projects.length === 0) {
        throw new Error('No projects found in file');
      }

      let createdCount = 0;
      let taskCount = 0;

      for (const projectData of projects) {
        try {
          const validatedProject = validateProjectData(projectData);
          const newProject = await projectsAPI.create(validatedProject);
          createdCount++;

          if (isJSON && tasksData) {
            const projectTasks = extractTasksFromJSON(tasksData, newProject.id, projectData.name);
            for (const taskData of projectTasks) {
              try {
                const validatedTask = validateTaskData({ ...taskData, project_id: newProject.id });
                await tasksAPI.create(validatedTask);
                taskCount++;
              } catch (taskError) {
                console.error('Error creating task:', taskError);
              }
            }
          }
        } catch (projectError) {
          console.error('Error creating project:', projectError);
          throw new Error(`Failed to create project "${projectData.name}": ${projectError.message}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      setCurrentPage(1);
      setImportSuccess(`Successfully imported ${createdCount} project(s)${taskCount > 0 ? ` with ${taskCount} task(s)` : ''}!`);

      setTimeout(() => {
        setImportSuccess('');
      }, 5000);
    } catch (error) {
      setImportError(error.message || 'Failed to import file. Please check the file format.');
    } finally {
      setImporting(false);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportFile(file);
    }
    e.target.value = '';
  };

  const handleQuickAddTask = async (taskData) => {
    await tasksAPI.create({
      project_id: taskData.project_id,
      title: taskData.title,
      due_date: taskData.due_date,
      estimated_minutes: taskData.estimated_minutes,
      status: 'todo',
      priority: 'medium',
      tags: [],
    });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setShowQuickAddForm(false);
  };

  const parseShareToken = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/\/share-links\/([a-f0-9]+)\/redeem/i);
    if (match?.[1]) return match[1];
    return raw;
  };

  const handleJoinSharedProject = async () => {
    const token = parseShareToken(shareLinkInput);
    if (!token) {
      setImportError('Enter a share URL or token');
      return;
    }

    setJoiningShareLink(true);
    setImportError('');
    setImportSuccess('');
    try {
      const result = await projectsAPI.redeemShareLink(token);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      setImportSuccess('Joined shared project successfully.');
      setShareLinkInput('');
      if (result?.project_id) {
        navigate(`/project/${result.project_id}`);
      }
    } catch (error) {
      setImportError(error.message || 'Failed to join shared project');
    } finally {
      setJoiningShareLink(false);
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
      <header className="relative z-40 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold shrink-0">
              <span className="text-amber-400">Ordered</span>PM
            </h1>
            <div className="hidden sm:block flex-1 max-w-md mx-4 relative z-[120]">
              <GlobalTaskSearch ref={globalSearchRef} />
            </div>
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
      <main className="relative z-0 max-w-7xl mx-auto px-6 md:px-12 py-8 md:py-12">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#e0e0e0] mb-4">
            {activeTab === 'today' ? "Build Today's plan" : activeTab === 'upcoming' ? 'Upcoming Tasks' : 'My Projects'}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setActiveTab('projects')}
                className={`h-11 px-4 rounded-lg text-sm leading-none font-medium transition-all inline-flex items-center justify-center whitespace-nowrap ${activeTab === 'projects'
                  ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
              >
                Projects
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`h-11 px-4 rounded-lg text-sm leading-none font-medium transition-all inline-flex items-center justify-center whitespace-nowrap ${activeTab === 'upcoming'
                  ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
              >
                Upcoming Tasks
              </button>
              <button
                onClick={() => {
                  if (hasCompletableTasks) {
                    setActiveTab('today');
                  }
                }}
                disabled={!hasCompletableTasks}
                className={`h-11 px-4 rounded-lg text-sm leading-none font-medium transition-all inline-flex items-center justify-center whitespace-nowrap ${activeTab === 'today'
                  ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                  } ${!hasCompletableTasks ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!hasCompletableTasks ? 'No tasks available to plan. Create tasks in active projects first.' : ''}
              >
                Auto-Plan
              </button>
            </div>
            {activeTab === 'projects' && (
              <>
                <div className="h-6 w-px bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <input
                    value={shareLinkInput}
                    onChange={(e) => setShareLinkInput(e.target.value)}
                    placeholder="Paste share link/token"
                    className="h-11 px-3 w-52 bg-white/5 border border-white/10 rounded-lg text-sm leading-none text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    onClick={handleJoinSharedProject}
                    disabled={joiningShareLink}
                    className="h-11 px-4 bg-blue-500/20 border border-blue-500/30 text-sm leading-none text-blue-300 font-medium rounded-lg hover:bg-blue-500/30 transition-all inline-flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                  >
                    {joiningShareLink ? 'Joining...' : 'Join via Link'}
                  </button>
                </div>
              </>
            )}
            {allProjects.length > 0 && activeTab === 'projects' && (
              <>
                <div className="h-6 w-px bg-white/10"></div>
                <div className="relative group">
                  <button
                    className="h-11 px-4 bg-white/5 border border-white/10 text-sm leading-none text-[#e0e0e0] font-medium rounded-lg hover:bg-white/10 transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    title="Export data"
                  >
                    📥 Export
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-[#252525] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <button
                      onClick={() => exportAllData(allProjects, allTasks, 'csv')}
                      className="w-full text-left px-4 py-2 text-sm text-[#e0e0e0] hover:bg-white/10 rounded-t-lg"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => exportAllData(allProjects, allTasks, 'json')}
                      className="w-full text-left px-4 py-2 text-sm text-[#e0e0e0] hover:bg-white/10 rounded-b-lg"
                    >
                      Export as JSON
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="import-file-input"
                    disabled={importing}
                  />
                  <label
                    htmlFor="import-file-input"
                    className={`h-11 px-4 bg-white/5 border border-white/10 text-sm leading-none text-[#e0e0e0] font-medium rounded-lg hover:bg-white/10 transition-all inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Import projects from JSON or CSV"
                  >
                    {importing ? '⏳ Importing...' : '📤 Import'}
                  </label>
                </div>
              </>
            )}
            <div className="h-6 w-px bg-white/10"></div>
            <button
              onClick={() => setShowQuickAddForm(true)}
              className="h-11 px-5 bg-gradient-to-r from-blue-400 to-blue-500 text-sm leading-none text-[#1a1a1a] font-semibold rounded-lg hover:from-blue-300 hover:to-blue-400 transition-all inline-flex items-center justify-center whitespace-nowrap shadow-lg shadow-blue-500/20"
            >
              + Quick Add Task
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="h-11 px-5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-sm leading-none text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all inline-flex items-center justify-center whitespace-nowrap shadow-lg shadow-yellow-500/20"
            >
              + New Project
            </button>
          </div>
        </div>

        {importError && (
          <div className="mb-6 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
            {importError}
          </div>
        )}

        {importSuccess && (
          <div className="mb-6 px-4 py-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
            {importSuccess}
          </div>
        )}

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

        {showQuickAddForm && (
          <div className="mb-8">
            <QuickAddTaskForm
              projects={activeProjectsForQuickAdd}
              onSubmit={async (taskData) => {
                try {
                  await tasksAPI.create(taskData);
                  queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
                  setShowQuickAddForm(false);
                } catch (err) {
                  throw err;
                }
              }}
              onCancel={() => setShowQuickAddForm(false)}
            />
          </div>
        )}

        {initialLoading && !projectsData ? (
          <div className="space-y-8">
            <StatsSkeleton />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {isFetching && projectsData && (
              <div className="text-center py-4 text-gray-500 text-sm italic opacity-70">
                Refreshing projects...
              </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-1">Total Projects</div>
                <div className="text-3xl font-bold text-[#e0e0e0]">{stats.totalProjects}</div>
              </div>
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-1">Active Tasks</div>
                <div className="text-3xl font-bold text-blue-400">{stats.activeTasks}</div>
              </div>
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-1">Overdue Tasks</div>
                <div className={`text-3xl font-bold ${stats.overdueTasks > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {stats.overdueTasks}
                </div>
              </div>
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-1">Completion Rate</div>
                <div className="text-3xl font-bold text-green-400">{stats.completionRate}%</div>
              </div>
            </div>

            {activeTab === 'projects' ? (
              <>
                {/* Search, Filter, and Sort Bar */}
                <div className="sticky top-0 z-20 backdrop-blur-xl bg-[#1a1a1a]/80 border border-white/10 rounded-lg p-4 mb-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'owned', label: 'Owned by me' },
                        { id: 'shared', label: 'Shared with me' }
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            setFilter(f.id);
                            setCurrentPage(1);
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f.id
                            ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                          {f.label}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setShowArchived(!showArchived);
                          setCurrentPage(1);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${showArchived
                          ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                          }`}
                      >
                        {showArchived ? '📦 Archived' : '📁 Active'}
                      </button>
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                    >
                      <option value="updated">Last Updated</option>
                      <option value="name">Name (A-Z)</option>
                      <option value="created_new">Date Created (Newest)</option>
                      <option value="created_old">Date Created (Oldest)</option>
                      <option value="tasks">Task Count</option>
                    </select>
                  </div>
                </div>

                {groupedProjects.owned.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#e0e0e0] mb-3">Owned by me</h3>
                    <ProjectList
                      projects={groupedProjects.owned}
                      allTasks={allTasks}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteClick}
                      onArchive={handleArchiveClick}
                      onRestore={handleRestoreClick}
                      showArchived={showArchived}
                    />
                  </div>
                )}
                {groupedProjects.sharedAdmin.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#e0e0e0] mb-3">Shared with me - Admin</h3>
                    <ProjectList
                      projects={groupedProjects.sharedAdmin}
                      allTasks={allTasks}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteClick}
                      onArchive={handleArchiveClick}
                      onRestore={handleRestoreClick}
                      showArchived={showArchived}
                    />
                  </div>
                )}
                {groupedProjects.sharedEditor.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#e0e0e0] mb-3">Shared with me - Editor</h3>
                    <ProjectList
                      projects={groupedProjects.sharedEditor}
                      allTasks={allTasks}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteClick}
                      onArchive={handleArchiveClick}
                      onRestore={handleRestoreClick}
                      showArchived={showArchived}
                    />
                  </div>
                )}
                {groupedProjects.sharedViewer.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[#e0e0e0] mb-3">Shared with me - Viewer</h3>
                    <ProjectList
                      projects={groupedProjects.sharedViewer}
                      allTasks={allTasks}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteClick}
                      onArchive={handleArchiveClick}
                      onRestore={handleRestoreClick}
                      showArchived={showArchived}
                    />
                  </div>
                )}
                {paginatedProjects.length === 0 && (
                  <ProjectList
                    projects={[]}
                    allTasks={allTasks}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onArchive={handleArchiveClick}
                    onRestore={handleRestoreClick}
                    sectionTitle={filter === 'owned' ? 'Owned by me' : filter === 'shared' ? 'Shared with me' : 'All'}
                    showArchived={showArchived}
                  />
                )}
                {totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      itemsPerPage={itemsPerPage}
                      totalItems={filteredAndSortedProjects.length}
                      hasMore={currentPage < totalPages}
                      isLoading={isFetching}
                    />
                  </div>
                )}
              </>
            ) : activeTab === 'upcoming' ? (
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-xl font-semibold text-[#e0e0e0]">Next 5 upcoming tasks</h3>
                  <span className="text-xs text-gray-500">Across all active projects</span>
                </div>
                {upcomingDueSoonTasks.length === 0 ? (
                  <p className="text-gray-400">No upcoming due tasks right now.</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingDueSoonTasks.map((task) => (
                      <Link
                        key={task.id}
                        to={`/project/${task.project_id}`}
                        state={{ openTaskId: task.id }}
                        className="block p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <div className="text-[#e0e0e0] font-medium">{task.title}</div>
                            <div className="text-sm text-gray-400">
                              {projectNameById.get(task.project_id) || 'Unknown Project'}
                            </div>
                          </div>
                          <div className="text-sm text-yellow-400">
                            Due {String(task.due_date).slice(0, 10)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-xl font-semibold text-[#e0e0e0]">Build Today's plan</h3>
                  <span className="text-xs text-gray-500">Across all active projects</span>
                </div>
                {!hasCompletableTasks && (
                  <div className="mb-4 px-4 py-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                    No tasks available to plan. Create tasks in active projects first.
                  </div>
                )}
                <div className="flex flex-col md:flex-row gap-3 mb-5">
                  <div className="w-full md:w-72">
                    <label className="block text-xs text-gray-400 mb-1">Daily time budget (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={todayPlanTimeBudget}
                      onChange={(e) => setTodayPlanTimeBudget(e.target.value)}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="120"
                    />
                  </div>
                  <button
                    onClick={() => handleGenerateTodayPlan({ save: false })}
                    disabled={todayPlanLoading || todayPlanSaving}
                    className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                  >
                    {todayPlanLoading ? 'Generating...' : 'Generate Preview'}
                  </button>
                  <button
                    onClick={() => handleGenerateTodayPlan({ save: true })}
                    disabled={todayPlanLoading || todayPlanSaving}
                    className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-300 hover:bg-green-500/30 transition-all disabled:opacity-50"
                  >
                    {todayPlanSaving ? 'Saving...' : 'Save Today Plan'}
                  </button>
                </div>

                {todayPlanError && (
                  <div className="mb-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {todayPlanError}
                  </div>
                )}
                {todayPlanSuccess && (
                  <div className="mb-4 px-4 py-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
                    {todayPlanSuccess}
                  </div>
                )}

                {todayPlanPreview ? (
                  <div className="space-y-5">
                    <div className="text-sm text-gray-400">
                      Planned {todayPlanPreview.used_minutes} / {todayPlanPreview.time_budget_minutes} minutes
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Included</h4>
                      <div className="space-y-2">
                        {todayPlanPreview.included_tasks.length === 0 ? (
                          <p className="text-sm text-gray-500">No tasks included.</p>
                        ) : todayPlanPreview.included_tasks.map((task) => (
                          <div key={task.id} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <div className="text-[#e0e0e0] font-medium">{task.title}</div>
                                <div className="text-xs text-gray-400">
                                  {projectNameById.get(task.project_id) || task.project_name || 'Unknown Project'} • {task.estimated_minutes || 30} min • {getPlanReasonLabel(task.reason)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleTodayPin(task.id)}
                                  className={`px-3 py-1 rounded text-xs border transition-all ${todayPlanPinnedTaskIds.includes(task.id)
                                    ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                    }`}
                                >
                                  {todayPlanPinnedTaskIds.includes(task.id) ? 'Unpin' : 'Pin'}
                                </button>
                                <Link
                                  to={`/project/${task.project_id}`}
                                  state={{ openTaskId: task.id }}
                                  className="px-3 py-1 rounded text-xs bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
                                >
                                  Open
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Excluded</h4>
                      <div className="space-y-2">
                        {todayPlanPreview.excluded_tasks.length === 0 ? (
                          <p className="text-sm text-gray-500">No excluded tasks.</p>
                        ) : todayPlanPreview.excluded_tasks.map((task) => (
                          <div key={task.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <div className="text-[#e0e0e0] font-medium">{task.title}</div>
                                <div className="text-xs text-gray-400">
                                  {projectNameById.get(task.project_id) || task.project_name || 'Unknown Project'} • {task.estimated_minutes || 30} min • {getPlanReasonLabel(task.reason)}
                                </div>
                              </div>
                              <button
                                onClick={() => toggleTodayPin(task.id)}
                                className={`px-3 py-1 rounded text-xs border transition-all ${todayPlanPinnedTaskIds.includes(task.id)
                                  ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
                                  : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                  }`}
                              >
                                {todayPlanPinnedTaskIds.includes(task.id) ? 'Unpin' : 'Pin'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">Generate a preview to see your recommended plan.</p>
                )}

                <div className="mt-6 pt-5 border-t border-white/10">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Saved For Today</h4>
                  {todaySavedTasks.length === 0 ? (
                    <p className="text-sm text-gray-500">No saved today plan yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {todaySavedTasks.map((task) => (
                        <Link
                          key={task.id}
                          to={`/project/${task.project_id}`}
                          state={{ openTaskId: task.id }}
                          className="block p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[#e0e0e0] font-medium">{task.title}</div>
                              <div className="text-xs text-gray-400">
                                {projectNameById.get(task.project_id) || task.project_name || 'Unknown Project'}
                              </div>
                            </div>
                            <span className="text-xs text-gray-400">
                              {task.estimated_minutes || 30} min{task.plan_pinned ? ' • pinned' : ''}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {showQuickAddForm && (
          <QuickAddTaskForm
            projects={activeProjectsForQuickAdd}
            onSubmit={handleQuickAddTask}
            onCancel={() => setShowQuickAddForm(false)}
          />
        )}

        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title="Delete Project"
          message="Are you sure you want to permanently delete this project? All tasks will be deleted too. This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmButtonClass="btn-danger"
        />
        <ConfirmDialog
          isOpen={archiveConfirm.isOpen}
          onClose={handleArchiveCancel}
          onConfirm={handleArchiveConfirm}
          title="Archive Project"
          message="Are you sure you want to archive this project? You can restore it later from the archived projects view."
          confirmText="Archive"
          cancelText="Cancel"
          confirmButtonClass="btn-warning"
        />
        <ConfirmDialog
          isOpen={restoreConfirm.isOpen}
          onClose={handleRestoreCancel}
          onConfirm={handleRestoreConfirm}
          title="Restore Project"
          message="Are you sure you want to restore this project? It will be moved back to your active projects."
          confirmText="Restore"
          cancelText="Cancel"
          confirmButtonClass="btn-success"
        />
      </main>
    </div>
  );
}

export default Dashboard;

