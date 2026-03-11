// client/src/components/TaskView.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksAPI } from '../services/api';
import SubtaskList from './SubtaskList';
import ActivityFeed from './ActivityFeed';
import TaskComments from './TaskComments';

const SketchUnderline = ({ className = '' }) => (
  <svg
    viewBox="0 0 240 18"
    preserveAspectRatio="none"
    aria-hidden="true"
    className={className}
  >
    <path
      d="M4 10c36 6 67 2 101 0 42-3 79-5 131-1"
      stroke="#D4AF37"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
      opacity="0.68"
    />
  </svg>
);

function TaskView({ task, onEdit, onClose, onTaskUpdate, canManageTasks = true, canDeleteTasks = true }) {
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

  const getCreatorName = (taskData) => taskData?.creator_full_name || taskData?.creator_username || 'Unknown';
  const getCreatorInitials = (taskData) => {
    const source = getCreatorName(taskData).trim();
    if (!source) return '?';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
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

  const inputClass = 'w-full rounded-[13px_11px_12px_14px] border border-[rgba(222,209,175,0.14)] bg-white/[0.04] px-3 py-2 text-sm text-[#f2e8d5] placeholder:text-[#8f8779] focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[rgba(212,175,55,0.45)]';
  const secondaryButtonClass = 'inline-flex h-10 items-center justify-center rounded-[12px_9px_11px_13px] border border-[rgba(222,209,175,0.14)] bg-white/[0.03] px-4 text-sm font-semibold text-[#ebe1cf] transition-all hover:border-[rgba(212,175,55,0.2)] hover:bg-white/[0.05] hover:text-[#f3e4b8] disabled:opacity-50';
  const primaryButtonClass = 'inline-flex h-10 items-center justify-center rounded-lg border border-[rgba(255,237,183,0.2)] bg-[#ecc94b] px-4 text-sm font-semibold text-[#161616] shadow-[0_10px_24px_rgba(212,175,55,0.2)] transition-all hover:bg-[#f0cf58] disabled:opacity-50';
  const subtleCardClass = 'rounded-[16px_13px_17px_14px] border border-[rgba(214,190,119,0.14)] bg-white/[0.03] p-3';

  const modalContent = (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm" style={{ zIndex: 99999 }}>
      <div className="relative w-full max-w-2xl my-auto">
        <div className="relative max-h-[90vh] overflow-y-auto rounded-[24px] border border-[rgba(214,190,119,0.14)] bg-[#151515] p-6 text-[#efe5cf] shadow-2xl md:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(212,175,55,0.13),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(212,175,55,0.06),transparent_20%),linear-gradient(180deg,rgba(21,21,21,0.97)_0%,rgba(19,19,19,0.99)_100%)]" />
          <div className="pointer-events-none absolute inset-[3px_2px_2px_3px] rounded-[22px] border border-[rgba(255,245,214,0.05)]" />

          <div className="relative">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="relative inline-block pb-3">
                  <h2 className="font-['Figtree_Variable','Inter','Plus_Jakarta_Sans',sans-serif] text-2xl font-bold tracking-[-0.04em] text-[#d4af37] md:text-3xl">
                    {currentTask.title}
                  </h2>
                  <SketchUnderline className="absolute bottom-0 left-0 h-3 w-full" />
                </div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[12px_9px_11px_13px] border border-[rgba(222,209,175,0.14)] bg-white/[0.03] text-[#b9ae99] transition-all hover:border-[rgba(212,175,55,0.2)] hover:bg-white/[0.05] hover:text-[#f3e4b8]"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {currentTask.description && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Description</h3>
                  <p className="whitespace-pre-wrap leading-relaxed text-[#efe5cf]">{currentTask.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Status</h3>
                  <span className={`inline-block rounded-[13px_10px_12px_14px] border px-3 py-1 text-sm font-medium ${getStatusColor(currentTask.status)}`}>
                    {currentTask.status === 'done' ? 'Done' : currentTask.status === 'in_progress' ? 'In Progress' : 'To Do'}
                  </span>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Priority</h3>
                  <span className={`inline-block rounded-[13px_10px_12px_14px] border px-3 py-1 text-sm font-medium ${getPriorityColor(currentTask.priority)}`}>
                    {formatPriority(currentTask.priority)}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Estimated Effort</h3>
                <p className="text-[#efe5cf]">
                  {currentTask.estimated_minutes ? `${currentTask.estimated_minutes} minutes` : 'Not set'}
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Focus Session</h3>
                {!canManageTasks && (
                  <p className="mb-3 text-xs text-[#8f8779]">Read-only access.</p>
                )}
                {focusError && (
                  <p className="mb-3 text-xs text-red-300">{focusError}</p>
                )}
                {canManageTasks && activeFocusOnAnotherTask && (
                  <div className="mb-3 rounded-[16px_13px_17px_14px] border border-[#d4af37]/25 bg-[#d4af37]/10 p-3 text-sm text-[#f0d792]">
                    You already have an active focus session on another task.
                  </div>
                )}
                {canManageTasks && isActiveFocusOnCurrentTask ? (
                  <div className="space-y-3">
                    <div className={`${subtleCardClass} border-[#d4af37]/20 bg-[#d4af37]/10`}>
                      <p className="mb-1 text-xs text-[#8f8779]">Time Remaining</p>
                      <p className="text-2xl font-bold text-[#f0d792]">{formatTimer(remainingSeconds)}</p>
                      {remainingSeconds === 0 && (
                        <p className="mt-1 text-xs text-[#f0d792]">Session timer finished. End session to log outcome.</p>
                      )}
                    </div>
                    <button
                      onClick={() => setShowEndFocusForm(!showEndFocusForm)}
                      className={secondaryButtonClass}
                    >
                      {showEndFocusForm ? 'Cancel End Session' : 'End Session'}
                    </button>
                    {showEndFocusForm && (
                      <div className={`${subtleCardClass} space-y-3`}>
                        <div>
                          <label className="mb-1 block text-xs text-[#8f8779]">Outcome</label>
                          <select
                            value={focusOutcome}
                            onChange={(e) => setFocusOutcome(e.target.value)}
                            className={inputClass}
                          >
                            <option value="completed">Completed</option>
                            <option value="progress">Made progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-[#8f8779]">Notes (optional)</label>
                          <textarea
                            value={focusNote}
                            onChange={(e) => setFocusNote(e.target.value)}
                            rows={2}
                            className={`${inputClass} resize-none`}
                            placeholder="Quick session notes"
                          />
                        </div>
                        {focusOutcome === 'completed' && (
                          <label className="flex items-center gap-2 text-sm text-[#d1c5af]">
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
                          className={primaryButtonClass}
                        >
                          {endFocusMutation.isPending ? 'Ending...' : 'Save Session'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : canManageTasks ? (
                  <div className="space-y-3">
                    <div className="flex items-end gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-[#8f8779]">Duration (minutes)</label>
                        <input
                          type="number"
                          min={1}
                          max={240}
                          value={focusDurationMinutes}
                          onChange={(e) => setFocusDurationMinutes(e.target.value)}
                          className={`${inputClass} w-28`}
                        />
                      </div>
                      <button
                        onClick={() => startFocusMutation.mutate()}
                        disabled={startFocusMutation.isPending || activeFocusOnAnotherTask}
                        className={secondaryButtonClass}
                      >
                        {startFocusMutation.isPending ? 'Starting...' : 'Start Focus'}
                      </button>
                    </div>
                    <p className="text-xs text-[#8f8779]">Pick one task, start a timer, and log outcome when done.</p>
                  </div>
                ) : null}
                {focusSessions.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-[#8f8779]">Recent Sessions</p>
                    <div className="space-y-2">
                      {focusSessions.slice(0, 3).map((session) => (
                        <div key={session.id} className={`${subtleCardClass} flex items-center justify-between gap-2 text-xs text-[#d1c5af]`}>
                          <span>{new Date(session.started_at).toLocaleString()}</span>
                          <span>{session.actual_minutes || session.planned_minutes} min - {session.outcome || 'in progress'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Dependencies</h3>
                {dependencyError && (
                  <p className="mb-3 text-xs text-red-300">{dependencyError}</p>
                )}
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs text-[#8f8779]">Blocked by</p>
                    {blockedBy.length === 0 ? (
                      <p className="text-sm text-[#8f8779]">No blockers</p>
                    ) : (
                      <div className="space-y-2">
                        {blockedBy.map((dep) => (
                          <div key={dep.id} className="flex items-center justify-between gap-3 rounded-[13px_11px_12px_14px] border border-[#d4af37]/18 bg-[#d4af37]/10 p-2.5">
                            <span className="text-sm text-[#efe5cf]">{dep.title}</span>
                            {canManageTasks && (
                              <button
                                onClick={() => removeDependencyMutation.mutate(dep.id)}
                                disabled={removeDependencyMutation.isPending}
                                className="rounded-[11px_9px_10px_12px] border border-[#d4af37]/25 px-2.5 py-1 text-xs text-[#f0d792] transition-all hover:bg-[#d4af37]/10 disabled:opacity-50"
                                title="Remove blocker"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canManageTasks && availableBlockers.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        <select
                          value={selectedBlockerId}
                          onChange={(e) => setSelectedBlockerId(e.target.value)}
                          className={`${inputClass} flex-1`}
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
                          className={secondaryButtonClass}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-xs text-[#8f8779]">Blocking</p>
                    {blocking.length === 0 ? (
                      <p className="text-sm text-[#8f8779]">Not blocking any tasks</p>
                    ) : (
                      <div className="space-y-2">
                        {blocking.map((dep) => (
                          <div key={dep.id} className="rounded-[13px_11px_12px_14px] border border-white/10 bg-white/[0.04] p-2.5">
                            <span className="text-sm text-[#efe5cf]">{dep.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {currentTask.recurrence_type && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Recurrence</h3>
                  <p className="text-[#efe5cf]">{formatRecurrence(currentTask)}</p>
                  {currentTask.recurrence_end_date && (
                    <p className="mt-1 text-sm text-[#b9ae99]">
                      Ends on {formatDate(currentTask.recurrence_end_date)}
                    </p>
                  )}
                </div>
              )}

              {(currentTask.start_date || currentTask.due_date) && (
                <div className="grid grid-cols-2 gap-4">
                  {currentTask.start_date && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Start Date</h3>
                      <p className="text-[#efe5cf]">{formatDate(currentTask.start_date)}</p>
                    </div>
                  )}
                  {currentTask.due_date && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Due Date</h3>
                      <p className="text-[#efe5cf]">{formatDate(currentTask.due_date)}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Created by</h3>
                <div className="flex items-center gap-3">
                  {currentTask.creator_avatar_url ? (
                    <img
                      src={currentTask.creator_avatar_url}
                      alt={getCreatorName(currentTask)}
                      className="h-8 w-8 rounded-full border border-[rgba(222,209,175,0.14)] object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(222,209,175,0.14)] bg-white/[0.04] text-xs font-semibold text-[#d1c5af]">
                      {getCreatorInitials(currentTask)}
                    </div>
                  )}
                  <div className="text-[#efe5cf]">
                    {getCreatorName(currentTask)}
                  </div>
                </div>
              </div>

              {currentTask.tags && Array.isArray(currentTask.tags) && currentTask.tags.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[#d4af37]">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {currentTask.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex rounded-[13px_10px_12px_14px] border border-[#d4af37]/18 bg-[#d4af37]/10 px-3 py-1 text-sm text-[#f0d792]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-[#d4af37]/10 pt-4">
                <SubtaskList
                  task={currentTask}
                  subtasks={currentTask.subtasks || []}
                  canManageTasks={canManageTasks}
                  canDeleteTasks={canDeleteTasks}
                  onTaskUpdate={(updatedTask) => {
                    if (onTaskUpdate) {
                      onTaskUpdate(updatedTask);
                    }
                  }}
                />
              </div>

              <div className="border-t border-[#d4af37]/10 pt-4">
                <ActivityFeed taskId={currentTask.id} />
              </div>

              <div className="border-t border-[#d4af37]/10 pt-4">
                <TaskComments taskId={currentTask.id} canManageTasks={canManageTasks} />
              </div>

              <div className="flex justify-end gap-4 border-t border-[#d4af37]/10 pt-4">
                <button
                  onClick={onClose}
                  className={secondaryButtonClass}
                >
                  Close
                </button>
                {canManageTasks && (
                  <button
                    onClick={() => {
                      onEdit(currentTask);
                      onClose();
                    }}
                    className={primaryButtonClass}
                  >
                    Edit Task
                  </button>
                )}
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
