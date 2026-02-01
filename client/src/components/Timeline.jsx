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
      <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col min-h-[300px] max-h-[500px]">
        <h3 className="text-lg font-semibold text-[#e0e0e0] mb-4">Upcoming</h3>
        <div className="text-center text-gray-500 text-sm py-8 flex-1 flex items-center justify-center">No upcoming tasks</div>
      </div>
    );
  }

  return (
    <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col min-h-[300px] max-h-[500px]">
      <h3 className="text-lg font-semibold text-[#e0e0e0] mb-4">Upcoming</h3>
      <div className="flex flex-col gap-3 overflow-y-auto flex-1">
        {upcomingTasks.map((task) => (
          <div
            key={task.id}
            className="flex gap-3 p-3 bg-white/5 border-l-2 border-blue-500 rounded-lg cursor-pointer hover:bg-white/10 hover:translate-x-1 transition-all"
            onClick={() => onTaskClick && onTaskClick(task)}
          >
            <div className="text-xs text-gray-400 font-medium whitespace-nowrap pt-0.5">
              {formatTime(task.due_date)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#e0e0e0] mb-1 truncate">{task.title}</div>
              <div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${task.priority === 'high'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : task.priority === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
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

