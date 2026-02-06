// client/src/components/SubtaskList.jsx
import React, { useState } from 'react';
import { tasksAPI } from '../services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function SubtaskList({ task, subtasks = [], onTaskUpdate }) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();

  if (!task || !task.id) {
    return null;
  }

  const createSubtaskMutation = useMutation({
    mutationFn: async (title) => {
      return await tasksAPI.createSubtask(task.id, {
        title,
        description: null,
        status: 'todo',
        priority: 'medium',
        due_date: null,
        start_date: null,
      });
    },
    onMutate: async (title) => {
      // Optimistically update the task's subtasks
      const newSubtask = {
        id: `temp-${Date.now()}`,
        parent_task_id: task.id,
        project_id: task.project_id,
        user_id: task.user_id,
        title: title.trim(),
        description: null,
        status: 'todo',
        priority: 'medium',
        due_date: null,
        start_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update task query cache
      queryClient.setQueryData(['task', task.id], (old) => {
        if (!old) return old;
        return {
          ...old,
          subtasks: [...(old.subtasks || []), newSubtask],
          total_subtasks: (old.total_subtasks || 0) + 1,
          completed_subtasks: old.completed_subtasks || 0,
        };
      });

      // Update tasks list cache
      queryClient.setQueryData(['tasks', task.project_id], (old) => {
        if (!old) return old;
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = oldArray.map((t) => {
          if (t.id === task.id) {
            return {
              ...t,
              subtasks: [...(t.subtasks || []), newSubtask],
              total_subtasks: (t.total_subtasks || 0) + 1,
              completed_subtasks: t.completed_subtasks || 0,
            };
          }
          return t;
        });

        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });

      return { previousTask: task };
    },
    onSuccess: (newSubtask) => {
      // Replace optimistic update with real data
      queryClient.setQueryData(['task', task.id], (old) => {
        if (!old) return old;
        const updatedSubtasks = (old.subtasks || []).map((st) =>
          st.id.startsWith('temp-') ? newSubtask : st
        );
        return {
          ...old,
          subtasks: updatedSubtasks,
        };
      });

      queryClient.setQueryData(['tasks', task.project_id], (old) => {
        if (!old) return old;
        const oldArray = Array.isArray(old) ? old : old?.data || [];
        const updatedArray = oldArray.map((t) => {
          if (t.id === task.id) {
            const updatedSubtasks = (t.subtasks || []).map((st) =>
              st.id.startsWith('temp-') ? newSubtask : st
            );
            return {
              ...t,
              subtasks: updatedSubtasks,
            };
          }
          return t;
        });

        if (Array.isArray(old)) {
          return updatedArray;
        } else if (old && typeof old === 'object' && 'data' in old) {
          return { ...old, data: updatedArray };
        }
        return updatedArray;
      });

      queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] });
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      setNewSubtaskTitle('');
      setIsAdding(false);

      // Notify parent component to update viewingTask if needed
      if (onTaskUpdate) {
        const updatedTask = queryClient.getQueryData(['task', task.id]);
        if (updatedTask) {
          onTaskUpdate(updatedTask);
        }
      }
    },
    onError: (err, title, context) => {
      // Rollback optimistic update
      if (context?.previousTask) {
        queryClient.setQueryData(['task', task.id], context.previousTask);
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] });
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ subtaskId, updates }) => {
      return await tasksAPI.update(subtaskId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] });
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId) => {
      return await tasksAPI.delete(subtaskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] });
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const handleToggleSubtask = (subtask) => {
    const newStatus = subtask.status === 'done' ? 'todo' : 'done';
    updateSubtaskMutation.mutate({
      subtaskId: subtask.id,
      updates: { status: newStatus },
    });
  };

  const handleAddSubtask = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!newSubtaskTitle.trim()) return;

    createSubtaskMutation.mutate(newSubtaskTitle.trim());
  };

  const handleDeleteSubtask = (subtaskId) => {
    if (window.confirm('Are you sure you want to delete this subtask?')) {
      deleteSubtaskMutation.mutate(subtaskId);
    }
  };

  const completedCount = subtasks.filter((st) => st.status === 'done').length;
  const totalCount = subtasks.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-[#e0e0e0]">Subtasks</h4>
          {totalCount > 0 && (
            <span className="text-xs text-gray-400">
              {completedCount}/{totalCount} completed
            </span>
          )}
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-all text-[#e0e0e0]"
          >
            + Add
          </button>
        )}
      </div>

      {totalCount > 0 && (
        <div className="w-full bg-white/5 rounded-full h-1.5 mb-2">
          <div
            className="bg-gradient-to-r from-blue-400 to-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}

      <div className="space-y-2">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className="flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
          >
            <input
              type="checkbox"
              checked={subtask.status === 'done'}
              onChange={() => handleToggleSubtask(subtask)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
            />
            <span
              className={`flex-1 text-sm ${subtask.status === 'done'
                ? 'line-through text-gray-500'
                : 'text-[#e0e0e0]'
                }`}
            >
              {subtask.title}
            </span>
            <button
              onClick={() => handleDeleteSubtask(subtask.id)}
              className="text-xs px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all"
              title="Delete subtask"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {isAdding && (
        <div
          className="flex gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleAddSubtask(e);
            }
          }}
        >
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Enter subtask title"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleAddSubtask(e);
              }
            }}
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
          <button
            type="button"
            disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddSubtask(e);
            }}
            className="px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all text-sm text-blue-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createSubtaskMutation.isPending ? '...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsAdding(false);
              setNewSubtaskTitle('');
            }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm text-gray-400"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default SubtaskList;
