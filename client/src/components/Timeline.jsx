// client/src/components/Timeline.js
import React, { useMemo } from 'react';

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
      <div className="dashboard-sketch-card dashboard-panel relative flex min-h-[300px] flex-col overflow-x-hidden rounded-[18px] p-4">
        <h3 className="dashboard-geometric mb-4 text-lg font-semibold text-[#d4af37]">Upcoming</h3>
        <div className="flex flex-1 items-center justify-center py-8 text-center text-sm text-[#8f8779]">No upcoming tasks</div>
      </div>
    );
  }

  return (
    <div className="dashboard-sketch-card dashboard-panel relative flex min-h-[300px] flex-col overflow-x-hidden rounded-[18px] p-4">
      <h3 className="dashboard-geometric mb-4 text-lg font-semibold text-[#d4af37]">Upcoming</h3>
      <div className="flex flex-1 flex-col gap-3">
        {upcomingTasks.map((task) => (
          <div
            key={task.id}
            className="flex cursor-pointer gap-3 rounded-[14px] border border-[#d4af37]/10 border-l-2 border-l-[#d4af37] bg-white/[0.03] p-3 transition-all hover:bg-white/[0.05] hover:translate-x-1"
            onClick={() => onTaskClick && onTaskClick(task)}
          >
            <div className="whitespace-nowrap pt-0.5 text-xs font-medium text-[#8f8779]">
              {formatTime(task.due_date)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="mb-1 truncate text-sm font-medium text-[#efe5cf]">{task.title}</div>
              <div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${task.priority === 'high'
                    ? 'border border-red-400/20 bg-red-500/10 text-red-300'
                    : task.priority === 'medium'
                      ? 'border border-[#d4af37]/20 bg-[#d4af37]/10 text-[#f0d792]'
                      : 'border border-slate-400/20 bg-slate-500/10 text-slate-300'
                  }`}>
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

