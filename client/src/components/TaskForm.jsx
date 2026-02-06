// client/src/components/TaskForm.js
import React, { useState, useEffect } from 'react';
import SubtaskList from './SubtaskList';

function TaskForm({ task, projectId, onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
      setDueDate(task.due_date ? task.due_date.split('T')[0] : '');
      setStartDate(task.start_date ? task.start_date.split('T')[0] : '');
      setPriority(task.priority || 'medium');
    } else {
      // Reset form when creating a new task
      setTitle('');
      setDescription('');
      setStatus('todo');
      setDueDate('');
      setStartDate('');
      setPriority('medium');
    }
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (task) {
        await onSubmit(task.id, { title, description, status, due_date: dueDate || null, start_date: startDate || null, priority });
      } else {
        await onSubmit({ project_id: projectId, title, description, status, due_date: dueDate || null, start_date: startDate || null, priority });
      }
    } catch (err) {
      setError(err.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto">
        {/* Glassmorphism Card */}
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Floating effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-50"></div>

          <div className="relative">
            <h2 className="text-2xl font-bold text-[#e0e0e0] mb-6">
              {task ? 'Edit Task' : 'New Task'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="task-title" className="block text-sm font-medium text-gray-400 mb-2">
                  Task Title *
                </label>
                <input
                  id="task-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Enter task title"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label htmlFor="task-description" className="block text-sm font-medium text-gray-400 mb-2">
                  Description
                </label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter task description (optional)"
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-vertical"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="task-status" className="block text-sm font-medium text-gray-400 mb-2">
                    Status
                  </label>
                  <select
                    id="task-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="task-priority" className="block text-sm font-medium text-gray-400 mb-2">
                    Priority
                  </label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="task-start-date" className="block text-sm font-medium text-gray-400 mb-2">
                    Start Date
                  </label>
                  <input
                    id="task-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="task-due-date" className="block text-sm font-medium text-gray-400 mb-2">
                    Due Date
                  </label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              {task && (
                <div className="pt-4 border-t border-white/10">
                  <SubtaskList task={task} subtasks={task.subtasks || []} />
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-[#e0e0e0] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : task ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskForm;

