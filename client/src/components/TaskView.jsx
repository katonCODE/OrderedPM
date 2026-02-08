// client/src/components/TaskView.jsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksAPI } from '../services/api';
import SubtaskList from './SubtaskList';

function TaskView({ task, onEdit, onClose, onTaskUpdate }) {
  const queryClient = useQueryClient();

  // Use useQuery to automatically subscribe to task updates
  const { data: currentTask } = useQuery({
    queryKey: ['task', task?.id],
    queryFn: () => tasksAPI.getById(task.id),
    enabled: !!task?.id,
    initialData: task,
    refetchOnWindowFocus: false,
  });

  // Update parent when task changes
  useEffect(() => {
    if (currentTask && onTaskUpdate) {
      onTaskUpdate(currentTask);
    }
  }, [currentTask, onTaskUpdate]);

  if (!currentTask) return null;

  const formatPriority = (priority) => {
    if (!priority) return 'Medium';
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'done':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" style={{ zIndex: 99999 }}>
      <div className="relative w-full max-w-2xl my-auto">
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-50"></div>

          <div className="relative">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-[#e0e0e0]">{currentTask.title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-[#e0e0e0]"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {currentTask.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Description</h3>
                  <p className="text-[#e0e0e0] leading-relaxed whitespace-pre-wrap">{currentTask.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Status</h3>
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium border ${getStatusColor(currentTask.status)}`}>
                    {currentTask.status === 'done' ? 'Done' : currentTask.status === 'in_progress' ? 'In Progress' : 'To Do'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Priority</h3>
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm font-medium border ${getPriorityColor(currentTask.priority)}`}>
                    {formatPriority(currentTask.priority)}
                  </span>
                </div>
              </div>

              {(currentTask.start_date || currentTask.due_date) && (
                <div className="grid grid-cols-2 gap-4">
                  {currentTask.start_date && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Start Date</h3>
                      <p className="text-[#e0e0e0]">{formatDate(currentTask.start_date)}</p>
                    </div>
                  )}
                  {currentTask.due_date && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Due Date</h3>
                      <p className="text-[#e0e0e0]">{formatDate(currentTask.due_date)}</p>
                    </div>
                  )}
                </div>
              )}

              {currentTask.tags && Array.isArray(currentTask.tags) && currentTask.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentTask.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-block px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-sm text-blue-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/10">
                <SubtaskList
                  task={currentTask}
                  subtasks={currentTask.subtasks || []}
                  onTaskUpdate={(updatedTask) => {
                    if (onTaskUpdate) {
                      onTaskUpdate(updatedTask);
                    }
                  }}
                />
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t border-white/10">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-[#e0e0e0] font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onEdit(currentTask);
                    onClose();
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20"
                >
                  Edit Task
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal in a portal to ensure it's always on top
  return createPortal(modalContent, document.body);
}

export default TaskView;
