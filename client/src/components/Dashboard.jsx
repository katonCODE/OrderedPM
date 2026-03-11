// client/src/components/Dashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsAPI, tasksAPI } from '../services/api';
import { getMyProfile } from '../services/profile';
import { exportAllData } from '../utils/export';
import { parseJSONFile, parseCSVFile, extractProjectsFromJSON, extractProjectsFromCSV, extractTasksFromJSON, validateProjectData, validateTaskData } from '../utils/import';
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

const SketchUnderline = ({ className = '' }) => (
  <svg
    viewBox="0 0 240 18"
    preserveAspectRatio="none"
    aria-hidden="true"
    className={`dashboard-sketch-line ${className}`}
  >
    <path
      d="M4 10c36 6 67 2 101 0 42-3 79-5 131-1"
      stroke="#D4AF37"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
      opacity="0.68"
    />
  </svg>
);

const BrandWordmark = ({ className = '' }) => (
  <span className={`dashboard-wordmark ${className}`}>
    <span className="dashboard-wordmark-text">OrderedPM</span>
    <SketchUnderline className="dashboard-wordmark-line" />
  </span>
);

const SectionHeading = ({ as: Tag = 'h2', className = '', children }) => (
  <div className={`dashboard-section-title ${className}`}>
    <Tag className="dashboard-section-title-text">{children}</Tag>
  </div>
);

const CollaborationCardHeading = ({ children }) => (
  <div className="dashboard-collab-heading">
    <h3 className="dashboard-section-title-text">{children}</h3>
    <SketchUnderline className="dashboard-collab-heading-line" />
  </div>
);

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
  const [exportingFormat, setExportingFormat] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [shareLinkInput, setShareLinkInput] = useState('');
  const [joiningShareLink, setJoiningShareLink] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const globalSearchRef = useRef(null);
  const importInputRef = useRef(null);
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
    if (!actionSuccess) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActionSuccess('');
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [actionSuccess]);

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
    setIsDragOver(false);
    setImporting(true);
    setActionError('');
    setActionSuccess('');

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
      const createdProjectNames = [];

      for (const projectData of projects) {
        try {
          const validatedProject = validateProjectData(projectData);
          const newProject = await projectsAPI.create(validatedProject);
          createdCount++;
          createdProjectNames.push(newProject?.name || validatedProject.name);

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
      setActiveTab('projects');
      const taskSummary = taskCount > 0 ? ` with ${taskCount} task${taskCount === 1 ? '' : 's'}` : '';
      const successMessage = createdCount === 1
        ? `Success! "${createdProjectNames[0]}" has been added to your dashboard${taskSummary}.`
        : `Success! ${createdCount} projects have been added to your dashboard${taskSummary}.`;
      setActionSuccess(successMessage);
    } catch (error) {
      setActionError(error.message || 'Failed to import file. Please check the file format.');
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
      setActionError('Enter a share URL or token');
      return;
    }

    setJoiningShareLink(true);
    setActionError('');
    setActionSuccess('');
    try {
      const result = await projectsAPI.redeemShareLink(token);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
      let joinedProjectName = '';
      if (result?.project_id) {
        try {
          const projectResponse = await projectsAPI.getById(result.project_id);
          joinedProjectName = projectResponse?.data?.name || projectResponse?.name || '';
        } catch (projectError) {
          joinedProjectName = '';
        }
      }
      setActionSuccess(
        joinedProjectName
          ? `Success! "${joinedProjectName}" has been added to your dashboard.`
          : 'Success! Shared project has been added to your dashboard.'
      );
      setShareLinkInput('');
      setCurrentPage(1);
      setActiveTab('projects');
    } catch (error) {
      setActionError(error.message || 'Failed to join shared project');
    } finally {
      setJoiningShareLink(false);
    }
  };

  const handleExportData = async (format) => {
    if (!allProjects.length) {
      setActionError('Create at least one project before exporting.');
      return;
    }

    setExportingFormat(format);
    setActionError('');
    setActionSuccess('');

    try {
      exportAllData(allProjects, allTasks, format);
      setActionSuccess(`Success! Your ${format.toUpperCase()} export is downloading.`);
    } catch (error) {
      setActionError(error.message || `Failed to export ${format.toUpperCase()} data.`);
    } finally {
      window.setTimeout(() => {
        setExportingFormat('');
      }, 600);
    }
  };

  const handleImportDrop = (event) => {
    event.preventDefault();
    if (importing) {
      return;
    }

    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleImportFile(file);
    }
  };

  const handleImportButtonClick = () => {
    if (!importing) {
      importInputRef.current?.click();
    }
  };

  return (
    <div className="dashboard-shell min-h-screen text-[#efe5cf]">
      <header className="dashboard-header-shell relative z-40">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl shrink-0 leading-none">
              <BrandWordmark />
            </h1>
            <div className="hidden sm:block flex-1 max-w-md mx-4 relative z-[120]">
              <GlobalTaskSearch ref={globalSearchRef} />
            </div>
            <div className="flex items-center gap-4">
              {profile && (
                <button
                  onClick={handleProfileClick}
                  className="dashboard-profile-button"
                  title={`View ${profile.full_name || profile.username}'s profile`}
                >
                  {profile.avatar_url ? (
                    <span className="dashboard-avatar-shell">
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name || profile.username}
                      />
                    </span>
                  ) : (
                    <div className="dashboard-avatar-shell">
                      <span>👤</span>
                    </div>
                  )}
                  <span className="dashboard-geometric text-sm font-medium hidden sm:inline">
                    {profile.full_name || profile.username}
                  </span>
                </button>
              )}
              <button
                onClick={onLogout}
                className="dashboard-ghost-link dashboard-geometric text-sm font-medium"
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
          <SectionHeading
            className="mb-4"
          >
            {activeTab === 'today'
              ? "Build Today's plan"
              : activeTab === 'collaboration'
                ? 'Import & Join'
                : activeTab === 'upcoming'
                  ? 'Upcoming Tasks'
                  : 'My Projects'}
          </SectionHeading>
          <div className="dashboard-action-row flex items-center justify-between w-full mb-6">
            <div className="dashboard-action-row-left flex items-center gap-2">
              <div className="dashboard-toolbar-tabs flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('projects')}
                  className={`dashboard-chip dashboard-row-control ${activeTab === 'projects'
                    ? 'dashboard-chip-active'
                    : ''
                    }`}
                >
                  Projects
                </button>
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={`dashboard-chip dashboard-row-control ${activeTab === 'upcoming'
                    ? 'dashboard-chip-active'
                    : ''
                    }`}
                >
                  Upcoming Tasks
                </button>
                <button
                  onClick={() => setActiveTab('collaboration')}
                  className={`dashboard-chip dashboard-row-control ${activeTab === 'collaboration'
                    ? 'dashboard-chip-active'
                    : ''
                    }`}
                >
                  Import & Join
                </button>
                <button
                  onClick={() => {
                    if (hasCompletableTasks) {
                      setActiveTab('today');
                    }
                  }}
                  disabled={!hasCompletableTasks}
                  className={`dashboard-chip dashboard-row-control ${activeTab === 'today'
                    ? 'dashboard-chip-active'
                    : ''
                    } ${!hasCompletableTasks ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!hasCompletableTasks ? 'No tasks available to plan. Create tasks in active projects first.' : ''}
                >
                  Auto-Plan
                </button>
              </div>
            </div>
            <div className="dashboard-action-row-right flex items-center gap-4">
              {activeTab === 'projects' && (
                <button
                  onClick={() => setShowForm(true)}
                  className="dashboard-primary-button dashboard-row-control"
                >
                  + New Project
                </button>
              )}
            </div>
          </div>
        </div>

        {actionSuccess && (
          <div className="dashboard-toast" role="status" aria-live="polite">
            <div className="dashboard-toast-title">Success</div>
            <div>{actionSuccess}</div>
          </div>
        )}

        {actionError && (
          <div className="dashboard-alert dashboard-alert--error mb-6">
            {actionError}
          </div>
        )}

        {error && (
          <div className="dashboard-alert dashboard-alert--error mb-6">
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
              onSubmit={handleQuickAddTask}
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
              <div className="text-center py-4 text-[#8f8779] text-sm italic opacity-70">
                Refreshing projects...
              </div>
            )}

            {activeTab !== 'collaboration' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="dashboard-sketch-card dashboard-stat-card">
                  <div className="dashboard-geometric text-sm text-[#b9ae99] mb-1">Total Projects</div>
                  <div className="dashboard-geometric text-3xl font-bold text-[#efe5cf]">{stats.totalProjects}</div>
                </div>
                <div className="dashboard-sketch-card dashboard-stat-card">
                  <div className="dashboard-geometric text-sm text-[#b9ae99] mb-1">Active Tasks</div>
                  <div className="dashboard-geometric text-3xl font-bold text-[#d4af37]">{stats.activeTasks}</div>
                </div>
                <div className="dashboard-sketch-card dashboard-stat-card">
                  <div className="dashboard-geometric text-sm text-[#b9ae99] mb-1">Overdue Tasks</div>
                  <div className={`dashboard-geometric text-3xl font-bold ${stats.overdueTasks > 0 ? 'text-red-300' : 'text-[#8f8779]'}`}>
                    {stats.overdueTasks}
                  </div>
                </div>
                <div className="dashboard-sketch-card dashboard-stat-card">
                  <div className="dashboard-geometric text-sm text-[#b9ae99] mb-1">Completion Rate</div>
                  <div className="dashboard-geometric text-3xl font-bold text-[#8fd6a3]">{stats.completionRate}%</div>
                </div>
              </div>
            )}

            {activeTab === 'projects' ? (
              <>
                {/* Search, Filter, and Sort Bar */}
                <div className="dashboard-sketch-card dashboard-control-bar sticky top-0 z-20 mb-6">
                  <div className="dashboard-filter-bar flex items-center gap-4 w-full bg-secondary/20 p-4 rounded-xl">
                    <div className="dashboard-search-shell flex-1 max-w-md flex items-center">
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="dashboard-input dashboard-row-control dashboard-search-input w-full max-w-sm"
                      />
                    </div>
                    <div className="dashboard-filter-scroller flex items-center gap-2">
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
                          className={`dashboard-chip dashboard-row-control flex items-center justify-center ${filter === f.id
                            ? 'dashboard-chip-active'
                            : ''
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
                        className={`dashboard-chip dashboard-row-control flex items-center justify-center ${showArchived
                          ? 'dashboard-chip-active'
                          : ''
                          }`}
                      >
                        {showArchived ? '📦 Archived' : '📁 Active'}
                      </button>
                    </div>
                    <div className="dashboard-sort-shell ml-auto w-fit flex items-center">
                      <select
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="dashboard-select dashboard-row-control dashboard-sort-select"
                      >
                        <option value="updated">Last Updated</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="created_new">Date Created (Newest)</option>
                        <option value="created_old">Date Created (Oldest)</option>
                        <option value="tasks">Task Count</option>
                      </select>
                    </div>
                  </div>
                </div>

                {groupedProjects.owned.length > 0 && (
                  <div className="mb-6">
                    <SectionHeading as="h3" className="mb-3">
                      Owned by me
                    </SectionHeading>
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
                    <SectionHeading as="h3" className="mb-3">
                      Shared with me - Admin
                    </SectionHeading>
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
                    <SectionHeading as="h3" className="mb-3">
                      Shared with me - Editor
                    </SectionHeading>
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
                    <SectionHeading as="h3" className="mb-3">
                      Shared with me - Viewer
                    </SectionHeading>
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
              <div className="dashboard-sketch-card dashboard-panel p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <SectionHeading as="h3">
                    Next 5 upcoming tasks
                  </SectionHeading>
                  <span className="text-xs text-[#8f8779]">Across all active projects</span>
                </div>
                {upcomingDueSoonTasks.length === 0 ? (
                  <p className="text-[#b9ae99]">No upcoming due tasks right now.</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingDueSoonTasks.map((task) => (
                      <Link
                        key={task.id}
                        to={`/project/${task.project_id}`}
                        state={{ openTaskId: task.id }}
                        className="dashboard-sketch-card dashboard-subtle-link block p-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <div className="dashboard-geometric text-[#efe5cf] font-medium">{task.title}</div>
                            <div className="text-sm text-[#b9ae99]">
                              {projectNameById.get(task.project_id) || 'Unknown Project'}
                            </div>
                          </div>
                          <div className="dashboard-geometric text-sm text-[#d4af37]">
                            Due {String(task.due_date).slice(0, 10)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'collaboration' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="dashboard-sketch-card dashboard-panel dashboard-collab-card p-6">
                  <CollaborationCardHeading>Join a Project</CollaborationCardHeading>
                  <p className="dashboard-collab-copy">
                    Paste a share link or token to add a shared workspace to your dashboard.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      value={shareLinkInput}
                      onChange={(e) => setShareLinkInput(e.target.value)}
                      placeholder="Paste share link or token"
                      className="dashboard-input dashboard-row-control flex-1 px-4"
                    />
                    <button
                      onClick={handleJoinSharedProject}
                      disabled={joiningShareLink}
                      className="dashboard-primary-button dashboard-row-control flex items-center gap-2 disabled:opacity-50"
                    >
                      {joiningShareLink && <span className="dashboard-spinner" aria-hidden="true" />}
                      {joiningShareLink ? 'Processing...' : 'Join Project'}
                    </button>
                  </div>
                </div>

                <div className="dashboard-sketch-card dashboard-panel dashboard-collab-card p-6">
                  <CollaborationCardHeading>Import Data</CollaborationCardHeading>
                  <p className="dashboard-collab-copy">
                    Drop in a JSON or CSV export, or upload a file to reuse the current import flow.
                  </p>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={importing}
                  />
                  <div
                    className={`dashboard-import-dropzone ${isDragOver ? 'dashboard-import-dropzone--active' : ''} ${importing ? 'opacity-70' : ''}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!importing) {
                        setIsDragOver(true);
                      }
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleImportDrop}
                  >
                    <p className="dashboard-collab-copy mb-0">
                      Drag and drop a backup file here, or use the upload button below.
                    </p>
                    <button
                      type="button"
                      onClick={handleImportButtonClick}
                      disabled={importing}
                      className="dashboard-secondary-button dashboard-row-control flex items-center gap-2 disabled:opacity-50"
                    >
                      {importing && <span className="dashboard-spinner" aria-hidden="true" />}
                      {importing ? 'Processing...' : 'Upload File'}
                    </button>
                    <div className="dashboard-collab-hint">Supported formats: `.json` and `.csv`.</div>
                  </div>
                </div>

                <div className="dashboard-sketch-card dashboard-panel dashboard-collab-card p-6 lg:col-span-2">
                  <CollaborationCardHeading>Export Data</CollaborationCardHeading>
                  <p className="dashboard-collab-copy">
                    Download a full backup of every project using the existing CSV and JSON export logic.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleExportData('csv')}
                      disabled={Boolean(exportingFormat)}
                      className="dashboard-secondary-button dashboard-row-control flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {exportingFormat === 'csv' && <span className="dashboard-spinner" aria-hidden="true" />}
                      {exportingFormat === 'csv' ? 'Processing...' : 'Export as CSV'}
                    </button>
                    <button
                      onClick={() => handleExportData('json')}
                      disabled={Boolean(exportingFormat)}
                      className="dashboard-secondary-button dashboard-row-control flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {exportingFormat === 'json' && <span className="dashboard-spinner" aria-hidden="true" />}
                      {exportingFormat === 'json' ? 'Processing...' : 'Export as JSON'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dashboard-sketch-card dashboard-panel p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <SectionHeading as="h3">
                    Build Today's plan
                  </SectionHeading>
                  <span className="text-xs text-[#8f8779]">Across all active projects</span>
                </div>
                {!hasCompletableTasks && (
                  <div className="dashboard-alert mb-4 border border-[#d4af37]/20 bg-[#d4af37]/10 text-[#f0d792] text-sm">
                    No tasks available to plan. Create tasks in active projects first.
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-end gap-3 mb-5">
                  <div className="w-full md:w-72">
                    <label className="dashboard-geometric block text-xs text-[#b9ae99] mb-1">Daily time budget (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={todayPlanTimeBudget}
                      onChange={(e) => setTodayPlanTimeBudget(e.target.value)}
                      className="dashboard-input dashboard-row-control px-4"
                      placeholder="120"
                    />
                  </div>
                  <button
                    onClick={() => handleGenerateTodayPlan({ save: false })}
                    disabled={todayPlanLoading || todayPlanSaving}
                    className="dashboard-secondary-button dashboard-row-control disabled:opacity-50"
                  >
                    {todayPlanLoading ? 'Generating...' : 'Generate Preview'}
                  </button>
                  <button
                    onClick={() => handleGenerateTodayPlan({ save: true })}
                    disabled={todayPlanLoading || todayPlanSaving}
                    className="dashboard-secondary-button dashboard-row-control disabled:opacity-50"
                  >
                    {todayPlanSaving ? 'Saving...' : 'Save Today Plan'}
                  </button>
                </div>

                {todayPlanError && (
                  <div className="dashboard-alert dashboard-alert--error mb-4 text-sm">
                    {todayPlanError}
                  </div>
                )}
                {todayPlanSuccess && (
                  <div className="dashboard-alert dashboard-alert--success mb-4 text-sm">
                    {todayPlanSuccess}
                  </div>
                )}

                {todayPlanPreview ? (
                  <div className="space-y-5">
                    <div className="text-sm text-[#b9ae99]">
                      Planned {todayPlanPreview.used_minutes} / {todayPlanPreview.time_budget_minutes} minutes
                    </div>

                    <div>
                      <h4 className="dashboard-geometric text-sm font-semibold text-[#d4af37] mb-2">Included</h4>
                      <div className="space-y-2">
                        {todayPlanPreview.included_tasks.length === 0 ? (
                          <p className="text-sm text-[#8f8779]">No tasks included.</p>
                        ) : todayPlanPreview.included_tasks.map((task) => (
                          <div key={task.id} className="dashboard-sketch-card p-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <div className="dashboard-geometric text-[#efe5cf] font-medium">{task.title}</div>
                                <div className="text-xs text-[#b9ae99]">
                                  {projectNameById.get(task.project_id) || task.project_name || 'Unknown Project'} • {task.estimated_minutes || 30} min • {getPlanReasonLabel(task.reason)}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleTodayPin(task.id)}
                                  className={`dashboard-chip min-h-0 px-3 py-1 text-xs ${todayPlanPinnedTaskIds.includes(task.id)
                                    ? 'dashboard-chip-active'
                                    : ''
                                    }`}
                                >
                                  {todayPlanPinnedTaskIds.includes(task.id) ? 'Unpin' : 'Pin'}
                                </button>
                                <Link
                                  to={`/project/${task.project_id}`}
                                  state={{ openTaskId: task.id }}
                                  className="dashboard-chip min-h-0 px-3 py-1 text-xs"
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
                      <h4 className="dashboard-geometric text-sm font-semibold text-[#d4af37] mb-2">Excluded</h4>
                      <div className="space-y-2">
                        {todayPlanPreview.excluded_tasks.length === 0 ? (
                          <p className="text-sm text-[#8f8779]">No excluded tasks.</p>
                        ) : todayPlanPreview.excluded_tasks.map((task) => (
                          <div key={task.id} className="dashboard-sketch-card p-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <div className="dashboard-geometric text-[#efe5cf] font-medium">{task.title}</div>
                                <div className="text-xs text-[#b9ae99]">
                                  {projectNameById.get(task.project_id) || task.project_name || 'Unknown Project'} • {task.estimated_minutes || 30} min • {getPlanReasonLabel(task.reason)}
                                </div>
                              </div>
                              <button
                                onClick={() => toggleTodayPin(task.id)}
                                className={`dashboard-chip min-h-0 px-3 py-1 text-xs ${todayPlanPinnedTaskIds.includes(task.id)
                                  ? 'dashboard-chip-active'
                                  : ''
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
                  <p className="text-[#b9ae99]">Generate a preview to see your recommended plan.</p>
                )}

                <div className="mt-6 pt-5 border-t border-[#d4af37]/10">
                  <h4 className="dashboard-geometric text-sm font-semibold text-[#d4af37] mb-2">Saved For Today</h4>
                  {todaySavedTasks.length === 0 ? (
                    <p className="text-sm text-[#8f8779]">No saved today plan yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {todaySavedTasks.map((task) => (
                        <Link
                          key={task.id}
                          to={`/project/${task.project_id}`}
                          state={{ openTaskId: task.id }}
                          className="dashboard-sketch-card dashboard-subtle-link block p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="dashboard-geometric text-[#efe5cf] font-medium">{task.title}</div>
                              <div className="text-xs text-[#b9ae99]">
                                {projectNameById.get(task.project_id) || task.project_name || 'Unknown Project'}
                              </div>
                            </div>
                            <span className="text-xs text-[#b9ae99]">
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

