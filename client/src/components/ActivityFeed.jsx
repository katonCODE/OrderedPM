// client/src/components/ActivityFeed.jsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksAPI } from '../services/api';

function ActivityFeed({ taskId }) {
  const { data: activitiesData, isLoading } = useQuery({
    queryKey: ['task-activities', taskId],
    queryFn: () => tasksAPI.getActivities(taskId, { limit: 50 }),
    enabled: !!taskId,
    refetchOnWindowFocus: false,
  });

  const activities = activitiesData?.data || [];

  const formatActivityMessage = (activity) => {
    const userName = activity.user_full_name || activity.user_username || 'Unknown';
    const userInitials = getUserInitials(activity);

    switch (activity.activity_type) {
      case 'created':
        return { message: 'created this task', icon: '✨' };
      case 'deleted':
        return { message: 'deleted this task', icon: '🗑️' };
      case 'status_changed':
        return {
          message: `changed status from "${formatStatus(activity.old_value)}" to "${formatStatus(activity.new_value)}"`,
          icon: '🔄'
        };
      case 'title_changed':
        return {
          message: `changed title from "${activity.old_value}" to "${activity.new_value}"`,
          icon: '📝'
        };
      case 'description_changed':
        return { message: 'updated the description', icon: '📄' };
      case 'due_date_changed':
        return {
          message: `changed due date from "${formatDate(activity.old_value)}" to "${formatDate(activity.new_value)}"`,
          icon: '📅'
        };
      case 'start_date_changed':
        return {
          message: `changed start date from "${formatDate(activity.old_value)}" to "${formatDate(activity.new_value)}"`,
          icon: '📅'
        };
      case 'priority_changed':
        return {
          message: `changed priority from "${formatPriority(activity.old_value)}" to "${formatPriority(activity.new_value)}"`,
          icon: '⚡'
        };
      case 'tag_added':
        return { message: `added tag "${activity.new_value}"`, icon: '🏷️' };
      case 'tag_removed':
        return { message: `removed tag "${activity.old_value}"`, icon: '🏷️' };
      case 'dependency_added':
        return { message: 'added a dependency', icon: '🔗' };
      case 'dependency_removed':
        return { message: 'removed a dependency', icon: '🔗' };
      case 'updated':
        const metadata = activity.metadata || {};
        const field = metadata.field;
        const action = metadata.action;

        if (field === 'estimated_minutes') {
          return {
            message: `changed estimated time from "${activity.old_value}" to "${activity.new_value}"`,
            icon: '⏱️'
          };
        }
        if (field === 'planned_for_date') {
          return {
            message: `changed planned date from "${formatDate(activity.old_value)}" to "${formatDate(activity.new_value)}"`,
            icon: '📅'
          };
        }
        if (field === 'plan_pinned') {
          return {
            message: action === 'pinned_to_plan' ? 'pinned this task to today\'s plan' : 'unpinned this task from today\'s plan',
            icon: '📌'
          };
        }
        if (field === 'recurrence') {
          return {
            message: `changed recurrence from "${activity.old_value}" to "${activity.new_value}"`,
            icon: '🔄'
          };
        }
        if (field === 'position') {
          return { message: 'moved this task in the kanban board', icon: '↔️' };
        }
        if (field === 'parent_task_id') {
          if (action === 'made_subtask') {
            return { message: 'made this task a subtask', icon: '📋' };
          }
          if (action === 'removed_from_parent') {
            return { message: 'removed this task from its parent', icon: '📋' };
          }
        }
        return { message: 'updated this task', icon: '✏️' };
      default:
        return { message: 'made a change', icon: '📝' };
    }
  };

  const formatStatus = (status) => {
    if (!status) return 'None';
    switch (status) {
      case 'todo': return 'To Do';
      case 'in_progress': return 'In Progress';
      case 'done': return 'Done';
      default: return status;
    }
  };

  const formatPriority = (priority) => {
    if (!priority) return 'None';
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'None';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getUserInitials = (activity) => {
    const name = activity.user_full_name || activity.user_username || 'Unknown';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400">Activity Feed</h3>
        <p className="text-xs text-gray-500">Loading...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-400">Activity Feed</h3>
        <p className="text-xs text-gray-500">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-400">Activity Feed</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {activities.map((activity) => {
          const { message, icon } = formatActivityMessage(activity);
          const userName = activity.user_full_name || activity.user_username || 'Unknown';
          const userInitials = getUserInitials(activity);

          return (
            <div key={activity.id} className="flex gap-3 p-2 bg-white/5 border border-white/10 rounded-lg">
              {activity.user_avatar_url ? (
                <img
                  src={activity.user_avatar_url}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 text-xs text-gray-300 flex items-center justify-center font-semibold flex-shrink-0">
                  {userInitials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#e0e0e0]">{userName}</span>
                  <span className="text-xs text-gray-400">{icon}</span>
                  <span className="text-xs text-gray-400">{message}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(activity.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActivityFeed;
