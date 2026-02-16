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
  const [focusDurationMinutes, setFocusDurationMinutes] = useState(task?.estimated_minutes || 25);
  const [focusError, setFocusError] = useState('');
  const [showEndFocusForm, setShowEndFocusForm] = useState(false);
  const [focusOutcome, setFocusOutcome] = useState('progress');
  const [focusNote, setFocusNote] = useState('');
  const [markDoneOnComplete, setMarkDoneOnComplete] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());

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

  const { data: activeFocusData } = useQuery({
    queryKey: ['active-focus-session'],
    queryFn: () => tasksAPI.getActiveFocusSession(),
    enabled: !!task?.id,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const { data: focusSessionsData } = useQuery({
    queryKey: ['task-focus-sessions', task?.id],
    queryFn: () => tasksAPI.getFocusSessions(task.id, { limit: 5 }),
    enabled: !!task?.id,
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

  const startFocusMutation = useMutation({
    mutationFn: () => tasksAPI.startFocusSession(currentTask.id, { planned_minutes: focusDurationMinutes }),
    onSuccess: () => {
      setFocusError('');
      setShowEndFocusForm(false);
      queryClient.invalidateQueries({ queryKey: ['active-focus-session'] });
      queryClient.invalidateQueries({ queryKey: ['task-focus-sessions', currentTask.id] });
    },
    onError: (error) => {
      setFocusError(error?.message || 'Failed to start focus session');
    },
  });

  const endFocusMutation = useMutation({
    mutationFn: () =>
      tasksAPI.endFocusSession(currentTask.id, activeFocusSession.id, {
        outcome: focusOutcome,
        note: focusNote,
      }),
    onSuccess: async () => {
      setFocusError('');
      if (focusOutcome === 'completed' && markDoneOnComplete && currentTask.status !== 'done') {
        try {
          await tasksAPI.update(currentTask.id, { status: 'done' });
        } catch (error) {
          setFocusError(error?.message || 'Session ended, but failed to mark task complete');
        }
      }
      setShowEndFocusForm(false);
      setFocusOutcome('progress');
      setFocusNote('');
      queryClient.invalidateQueries({ queryKey: ['active-focus-session'] });
      queryClient.invalidateQueries({ queryKey: ['task-focus-sessions', currentTask.id] });
      queryClient.invalidateQueries({ queryKey: ['task', currentTask.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks', currentTask.project_id] });
    },
    onError: (error) => {
      setFocusError(error?.message || 'Failed to end focus session');
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

  useEffect(() => {
    setFocusDurationMinutes(task?.estimated_minutes || 25);
    setFocusError('');
    setShowEndFocusForm(false);
    setFocusOutcome('progress');
    setFocusNote('');
    setMarkDoneOnComplete(true);
  }, [task?.id, task?.estimated_minutes]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!currentTask) return null;

  const blockedBy = dependencies?.blocked_by || [];
  const blocking = dependencies?.blocking || [];
  const projectTasks = projectTasksData?.data || projectTasksData || [];
  const activeFocusSession = activeFocusData?.data ?? null;
  const focusSessions = focusSessionsData?.data ?? [];
  const isActiveFocusOnCurrentTask = !!activeFocusSession && activeFocusSession.task_id === currentTask.id && !activeFocusSession.ended_at;
  const activeFocusOnAnotherTask = !!activeFocusSession && activeFocusSession.task_id !== currentTask.id && !activeFocusSession.ended_at;
  const startedAtMs = isActiveFocusOnCurrentTask ? new Date(activeFocusSession.started_at).getTime() : null;
  const targetEndMs = startedAtMs ? startedAtMs + (activeFocusSession.planned_minutes * 60 * 1000) : null;
  const remainingSeconds = targetEndMs ? Math.max(0, Math.ceil((targetEndMs - nowMs) / 1000)) : 0;

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

  const formatTimer = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Estimated Effort</h3>
                <p className="text-[#e0e0e0]">
                  {currentTask.estimated_minutes ? `${currentTask.estimated_minutes} minutes` : 'Not set'}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Focus Session</h3>
                {focusError && (
                  <p className="text-xs text-red-400 mb-3">{focusError}</p>
                )}
                {activeFocusOnAnotherTask && (
                  <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-300">
                    You already have an active focus session on another task.
                  </div>
                )}
                {isActiveFocusOnCurrentTask ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-xs text-gray-400 mb-1">Time Remaining</p>
                      <p className="text-2xl font-bold text-blue-300">{formatTimer(remainingSeconds)}</p>
                      {remainingSeconds === 0 && (
                        <p className="text-xs text-yellow-300 mt-1">Session timer finished. End session to log outcome.</p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowEndFocusForm(!showEndFocusForm)}
                      className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-500/30 transition-all"
                    >
                      {showEndFocusForm ? 'Cancel End Session' : 'End Session'}
                    </button>
                    {showEndFocusForm && (
                      <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Outcome</label>
                          <select
                            value={focusOutcome}
                            onChange={(e) => setFocusOutcome(e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <option value="completed">Completed</option>
                            <option value="progress">Made progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
                          <textarea
                            value={focusNote}
                            onChange={(e) => setFocusNote(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                            placeholder="Quick session notes"
                          />
                        </div>
                        {focusOutcome === 'completed' && (
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="checkbox"
                              checked={markDoneOnComplete}
                              onChange={(e) => setMarkDoneOnComplete(e.target.checked)}
                              className="rounded border-white/20 bg-white/5"
                            />
                            Mark task as done
                          </label>
                        )}
                        <button
                          onClick={() => endFocusMutation.mutate()}
                          disabled={endFocusMutation.isPending}
                          className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-300 hover:bg-green-500/30 transition-all disabled:opacity-50"
                        >
                          {endFocusMutation.isPending ? 'Ending...' : 'Save Session'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-end gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Duration (minutes)</label>
                        <input
                          type="number"
                          min={1}
                          max={240}
                          value={focusDurationMinutes}
                          onChange={(e) => setFocusDurationMinutes(e.target.value)}
                          className="w-28 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <button
                        onClick={() => startFocusMutation.mutate()}
                        disabled={startFocusMutation.isPending || activeFocusOnAnotherTask}
                        className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                      >
                        {startFocusMutation.isPending ? 'Starting...' : 'Start Focus'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">Pick one task, start a timer, and log outcome when done.</p>
                  </div>
                )}
                {focusSessions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-2">Recent Sessions</p>
                    <div className="space-y-2">
                      {focusSessions.slice(0, 3).map((session) => (
                        <div key={session.id} className="p-2 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 flex justify-between items-center gap-2">
                          <span>
                            {new Date(session.started_at).toLocaleString()}
                          </span>
                          <span>
                            {session.actual_minutes || session.planned_minutes} min - {session.outcome || 'in progress'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
