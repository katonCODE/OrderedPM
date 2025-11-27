// client/src/components/TaskList.js
import React from 'react';
import './TaskList.css';

function TaskList({ tasks, onEdit, onDelete, onStatusChange }) {
  const getStatusClass = (status) => {
    switch (status) {
      case 'done':
        return 'status-done';
      case 'in_progress':
        return 'status-in-progress';
      default:
        return 'status-todo';
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return 'priority-medium';
    }
  };

  const formatPriority = (priority) => {
    if (!priority) return 'Medium';
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <p>No tasks yet. Create your first task to get started!</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <div key={task.id} className="task-card">
          <div className="task-content">
            <div className="task-header">
              <h4>{task.title}</h4>
              <select
                value={task.status}
                onChange={(e) => onStatusChange(task.id, e.target.value)}
                className={`status-select ${getStatusClass(task.status)}`}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            {task.description && (
              <p className="task-description">{task.description}</p>
            )}
            <div className="task-meta">
              <span className="task-date">
                Created {new Date(task.created_at).toLocaleDateString()}
              </span>
              {task.due_date && (
                <span className="task-due-date">
                  Due {new Date(task.due_date).toLocaleDateString()}
                </span>
              )}
              {task.priority && (
                <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                  {formatPriority(task.priority)}
                </span>
              )}
            </div>
          </div>
          <div className="task-actions">
            <button onClick={() => onEdit(task)} className="btn-icon" title="Edit">
              ✏️
            </button>
            <button onClick={() => onDelete(task.id)} className="btn-icon btn-danger" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TaskList;

