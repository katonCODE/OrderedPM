// client/src/components/ProjectList.js
import React from 'react';
import { Link } from 'react-router-dom';

function ProjectList({ projects, onEdit, onDelete }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400 text-lg">
        <p>No projects yet. Create your first project to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <div
          key={project.id}
          className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all group"
        >
          {/* Subtle glow effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity"></div>

          <div className="relative flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <Link to={`/project/${project.id}`} className="block">
                <h3 className="text-xl font-semibold text-[#e0e0e0] mb-2 hover:text-white transition-colors truncate">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
              </Link>
              <div className="text-xs text-gray-500">
                Created {new Date(project.created_at).toLocaleDateString()}
              </div>
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
        </div>
      ))}
    </div>
  );
}

export default ProjectList;

