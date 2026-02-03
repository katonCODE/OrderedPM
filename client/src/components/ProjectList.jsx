// client/src/components/ProjectList.js
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

function ProjectList({ projects, allTasks = [], onEdit, onDelete }) {
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
      <div className="text-center py-20 text-gray-400 text-lg">
        <p>No projects found. {allTasks.length === 0 ? 'Create your first project to get started!' : 'Try adjusting your search or filters.'}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => {
        const stats = getProjectStats(project.id);
        const lastUpdated = project.updated_at || project.created_at;

        return (
          <div
            key={project.id}
            className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all group"
          >
            {stats.overdueTasks > 0 && (
              <div className="absolute top-3 right-3 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-medium">
                {stats.overdueTasks} overdue
              </div>
            )}

            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity"></div>

            <div className="relative">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <Link to={`/project/${project.id}`} className="block">
                    <h3 className="text-xl font-semibold text-[#e0e0e0] mb-2 hover:text-white transition-colors truncate">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </Link>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => onEdit(project)}
                    className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-gray-400 hover:text-[#e0e0e0]"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDelete(project.id)}
                    className="p-2 bg-white/5 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-all text-gray-400 hover:text-red-400"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {stats.totalTasks > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-400">Progress</span>
                      <span className="text-xs font-medium text-[#e0e0e0]">{stats.completionRate}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${stats.completionRate}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4 text-gray-400">
                    <span>{stats.totalTasks} {stats.totalTasks === 1 ? 'task' : 'tasks'}</span>
                    {stats.totalTasks > 0 && (
                      <span className="text-green-400">{stats.doneTasks} done</span>
                    )}
                  </div>
                  <div className="text-gray-500">
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

