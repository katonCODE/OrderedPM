// client/src/components/ProjectList.js
import React from 'react';
import { Link } from 'react-router-dom';
import './ProjectList.css';

function ProjectList({ projects, onEdit, onDelete }) {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <p>No projects yet. Create your first project to get started!</p>
      </div>
    );
  }

  return (
    <div className="project-list">
      {projects.map((project) => (
        <div key={project.id} className="project-card">
          <div className="project-content">
            <Link to={`/project/${project.id}`} className="project-link">
              <h3>{project.name}</h3>
              {project.description && <p className="project-description">{project.description}</p>}
            </Link>
            <div className="project-meta">
              <span className="project-date">
                Created {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="project-actions">
            <button onClick={() => onEdit(project)} className="btn-icon" title="Edit">
              ✏️
            </button>
            <button onClick={() => onDelete(project.id)} className="btn-icon btn-danger" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ProjectList;

