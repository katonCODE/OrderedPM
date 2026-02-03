// client/src/components/Dashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsAPI, tasksAPI } from '../services/api';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
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
    queryKey: ['projects'],
    queryFn: () => projectsAPI.getAll({
      limit: 1000,
      offset: 0,
      includeCount: false
    }),
    placeholderData: (previousData) => previousData,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => tasksAPI.getAllForUser(),
    placeholderData: (previousData) => previousData,
  });

  const allProjects = projectsData?.data || projectsData || [];
  const allTasks = tasksData?.data || [];

  const error = queryError?.message || '';

  const stats = useMemo(() => {
    const totalProjects = allProjects.length;
    const activeTasks = allTasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length;
    const overdueTasks = allTasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < new Date();
    }).length;
    const doneTasks = allTasks.filter(t => t.status === 'done').length;
    const completionRate = allTasks.length > 0
      ? Math.round((doneTasks / allTasks.length) * 100)
      : 0;

    return {
      totalProjects,
      activeTasks,
      overdueTasks,
      completionRate
    };
  }, [allProjects, allTasks]);

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = [...allProjects];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    if (filter === 'active') {
      const projectIdsWithActiveTasks = new Set(
        allTasks
          .filter(t => t.status === 'todo' || t.status === 'in_progress')
          .map(t => t.project_id)
      );
      filtered = filtered.filter(p => projectIdsWithActiveTasks.has(p.id));
    } else if (filter === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filtered = filtered.filter(p => new Date(p.updated_at || p.created_at) >= sevenDaysAgo);
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

  const totalPages = Math.ceil(filteredAndSortedProjects.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

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
                <div className="flex gap-2">
                  {['all', 'active', 'recent'].map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setFilter(f);
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f
                          ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
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

            <ProjectList
              projects={paginatedProjects}
              allTasks={allTasks}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
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

