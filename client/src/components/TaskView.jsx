// client/src/components/TaskView.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksAPI } from '../services/api';
import SubtaskList from './SubtaskList';

function TaskView({ task, onEdit, onClose, onTaskUpdate }) {
  const queryClient = useQueryClient();
  const [selectedBlockerId, setSelectedBlockerId] = useState('');
  const [dependencyError, setDependencyError] = useState('');

  // Use useQuery to automatically subscribe to task updates
  const { data: currentTask } = useQuery({
    queryKey: ['task', task?.id],
    queryFn: () => tasksAPI.getById(task.id),
    enabled: !!task?.id,
    initialData: task,
    refetchOnWindowFocus: false,
  });

  const { data: dependencies } = useQuery({
    queryKey: ['task-dependencies', task?.id],
    queryFn: () => tasksAPI.getDependencies(task.id),
    enabled: !!task?.id,
    refetchOnWindowFocus: false,
  });

  const { data: projectTasksData } = useQuery({
    queryKey: ['tasks', currentTask?.project_id],
    queryFn: () => tasksAPI.getByProject(currentTask.project_id, { limit: 1000, offset: 0 }),
    enabled: !!currentTask?.project_id,
    refetchOnWindowFocus: false,
  });

  const addDependencyMutation = useMutation({
    mutationFn: (blockerTaskId) => tasksAPI.addDependency(currentTask.id, blockerTaskId),
    onSuccess: () => {
      setDependencyError('');
      setSelectedBlockerId('');
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', currentTask.id] });
      queryClient.invalidateQueries({ queryKey: ['task', currentTask.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks', currentTask.project_id] });
    },
    onError: (error) => {
      setDependencyError(error?.message || 'Failed to add dependency');
    },
  });

  const removeDependencyMutation = useMutation({
    mutationFn: (blockerTaskId) => tasksAPI.removeDependency(currentTask.id, blockerTaskId),
    onSuccess: () => {
      setDependencyError('');
      queryClient.invalidateQueries({ queryKey: ['task-dependencies', currentTask.id] });
      queryClient.invalidateQueries({ queryKey: ['task', currentTask.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks', currentTask.project_id] });
    },
    onError: (error) => {
      setDependencyError(error?.message || 'Failed to remove dependency');
    },
  });

  // Update parent when task changes
  useEffect(() => {
    if (currentTask && onTaskUpdate) {
      onTaskUpdate(currentTask);
    }
  }, [currentTask, onTaskUpdate]);

  useEffect(() => {
    setSelectedBlockerId('');
    setDependencyError('');
  }, [task?.id]);

  if (!currentTask) return null;

  const blockedBy = dependencies?.blocked_by || [];
  const blocking = dependencies?.blocking || [];
  const projectTasks = projectTasksData?.data || projectTasksData || [];

  const availableBlockers = useMemo(() => {
    const existingBlockerIds = new Set(blockedBy.map(dep => dep.id));
    return projectTasks.filter(
      (projectTask) =>
        projectTask.id !== currentTask.id &&
        !existingBlockerIds.has(projectTask.id)
    );
  }, [blockedBy, currentTask.id, projectTasks]);

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

  const formatRecurrence = (task) => {
    if (!task?.recurrence_type) return null;
    const interval = task.recurrence_interval || 1;
    const unit = task.recurrence_type.charAt(0).toUpperCase() + task.recurrence_type.slice(1);
    return interval > 1 ? `Every ${interval} ${unit}` : `Every ${unit}`;
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

              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Dependencies</h3>
                {dependencyError && (
                  <p className="text-xs text-red-400 mb-3">{dependencyError}</p>
                )}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Blocked by</p>
                    {blockedBy.length === 0 ? (
                      <p className="text-sm text-gray-500">No blockers</p>
                    ) : (
                      <div className="space-y-2">
                        {blockedBy.map((dep) => (
                          <div key={dep.id} className="flex items-center justify-between gap-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                            <span className="text-sm text-[#e0e0e0]">{dep.title}</span>
                            <button
                              onClick={() => removeDependencyMutation.mutate(dep.id)}
                              disabled={removeDependencyMutation.isPending}
                              className="px-2 py-1 text-xs text-orange-300 border border-orange-500/30 rounded hover:bg-orange-500/20 transition-all disabled:opacity-50"
                              title="Remove blocker"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {availableBlockers.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        <select
                          value={selectedBlockerId}
                          onChange={(e) => setSelectedBlockerId(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        >
                          <option value="">Select blocker task</option>
                          {availableBlockers.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.title}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => selectedBlockerId && addDependencyMutation.mutate(selectedBlockerId)}
                          disabled={!selectedBlockerId || addDependencyMutation.isPending}
                          className="px-3 py-2 bg-orange-500/20 border border-orange-500/30 rounded-lg text-sm text-orange-300 hover:bg-orange-500/30 transition-all disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 mb-2">Blocking</p>
                    {blocking.length === 0 ? (
                      <p className="text-sm text-gray-500">Not blocking any tasks</p>
                    ) : (
                      <div className="space-y-2">
                        {blocking.map((dep) => (
                          <div key={dep.id} className="p-2 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                            <span className="text-sm text-[#e0e0e0]">{dep.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {currentTask.recurrence_type && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Recurrence</h3>
                  <p className="text-[#e0e0e0]">{formatRecurrence(currentTask)}</p>
                  {currentTask.recurrence_end_date && (
                    <p className="text-sm text-gray-400 mt-1">
                      Ends on {formatDate(currentTask.recurrence_end_date)}
                    </p>
                  )}
                </div>
              )}

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
