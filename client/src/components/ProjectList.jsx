// client/src/components/ProjectList.js
import React from 'react';
import { Link } from 'react-router-dom';

function ProjectList({
  projects,
  allTasks = [],
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  onLeave,
  sectionTitle = '',
  showArchived = false
}) {
  const getProgressStyle = (completionRate) => {
    const hue = Math.round((Math.max(0, Math.min(100, completionRate)) / 100) * 120);
    return {
      width: `${completionRate}%`,
      '--progress-hue': `${hue}`,
    };
  };

  const getProjectStats = (projectId) => {
    const projectTasks = allTasks.filter(t => t.project_id === projectId);
    const totalTasks = projectTasks.length;
    const doneTasks = projectTasks.filter(t => t.status === 'done').length;
    const overdueTasks = projectTasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < new Date();
    }).length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      doneTasks,
      overdueTasks,
      completionRate
    };
  };

  if (projects.length === 0) {
    return (
      <div className="dashboard-geometric text-center py-20 text-[#b9ae99] text-lg">
        <p>
          {sectionTitle ? `${sectionTitle}: ` : ''}
          No projects found. {allTasks.length === 0 ? 'Create your first project to get started!' : 'Try adjusting your search or filters.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => {
        const stats = getProjectStats(project.id);
        const lastUpdated = project.updated_at || project.created_at;
        const isOwner = project.is_owner !== false;

        return (
          <div
            key={project.id}
            className={`dashboard-sketch-card dashboard-panel relative p-6 transition-colors group ${project.archived
              ? 'opacity-75'
              : 'hover:bg-white/[0.045]'
              }`}
          >
            {project.archived && (
              <div className="dashboard-pill dashboard-pill--archived absolute top-3 right-3">
                Archived
              </div>
            )}
            {!project.archived && (
              <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
                {!isOwner && (
                  <div className="dashboard-pill dashboard-pill--shared capitalize">
                    Shared ({project.permission_level || 'viewer'})
                  </div>
                )}
                {stats.overdueTasks > 0 && (
                  <div className="dashboard-pill dashboard-pill--danger">
                    {stats.overdueTasks} overdue
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <Link to={`/project/${project.id}`} className="block">
                    <h3 className="dashboard-geometric text-xl font-semibold text-[#efe5cf] mb-2 hover:text-[#f7ecd0] transition-colors truncate">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-[#b9ae99] mb-3 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </Link>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!project.archived && isOwner && (
                    <>
                      <button
                        onClick={() => onEdit(project)}
                        className="dashboard-icon-button"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      {onArchive && (
                        <button
                          onClick={() => onArchive(project.id)}
                          className="dashboard-icon-button"
                          title="Archive"
                        >
                          📦
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(project.id)}
                        className="dashboard-icon-button"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                  {project.archived && onRestore && isOwner && (
                    <>
                      <button
                        onClick={() => onRestore(project.id)}
                        className="dashboard-icon-button"
                        title="Restore"
                      >
                        ♻️
                      </button>
                      <button
                        onClick={() => onDelete(project.id)}
                        className="dashboard-icon-button"
                        title="Delete Permanently"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                  {!project.archived && !isOwner && onLeave && (
                    <button
                      onClick={() => onLeave(project)}
                      className="dashboard-icon-button"
                      title="Leave Project"
                    >
                      🚪
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {stats.totalTasks > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="dashboard-geometric text-xs text-[#b9ae99]">Progress</span>
                      <span className="dashboard-geometric text-xs font-medium text-[#efe5cf]">{stats.completionRate}%</span>
                    </div>
                    <div className="dashboard-progress-track w-full">
                      <div
                        className="dashboard-progress-fill dashboard-progress-fill--marker transition-all"
                        style={getProgressStyle(stats.completionRate)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4 text-[#b9ae99]">
                    <span>{stats.totalTasks} {stats.totalTasks === 1 ? 'task' : 'tasks'}</span>
                    {stats.totalTasks > 0 && (
                      <span className="text-[#8fd6a3]">{stats.doneTasks} done</span>
                    )}
                  </div>
                  <div className="text-[#8f8779]">
                    Updated {new Date(lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ProjectList;

