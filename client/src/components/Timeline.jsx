// client/src/components/Timeline.js
import React, { useMemo } from 'react';
import './Timeline.css';

function Timeline({ tasks, onTaskClick }) {
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter(task => task.status !== 'done' && task.due_date)
      .sort((a, b) => {
        const dateA = new Date(a.due_date);
        const dateB = new Date(b.due_date);
        return dateA - dateB;
      })
      .slice(0, 10);
  }, [tasks]);

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

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);
    
    const diffTime = taskDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (upcomingTasks.length === 0) {
    return (
      <div className="timeline">
        <h3>Upcoming</h3>
        <div className="timeline-empty">No upcoming tasks</div>
      </div>
    );
  }

  return (
    <div className="timeline">
      <h3>Upcoming</h3>
      <div className="timeline-list">
        {upcomingTasks.map((task) => (
          <div
            key={task.id}
            className="timeline-item"
            onClick={() => onTaskClick && onTaskClick(task)}
          >
            <div className="timeline-time">{formatTime(task.due_date)}</div>
            <div className="timeline-content">
              <div className="timeline-title">{task.title}</div>
              <div className="timeline-meta">
                <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                  {formatPriority(task.priority)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Timeline;

