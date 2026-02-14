import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function QuickAddTaskForm({ projects = [], onSubmit, onCancel }) {
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(String(projects[0].id));
    }
  }, [projects, projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!projectId) {
      setError('Please choose a project.');
      return;
    }
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        project_id: projectId,
        title: title.trim(),
        due_date: dueDate || null,
        estimated_minutes: estimatedMinutes ? Math.max(1, Number(estimatedMinutes) || 1) : null,
      });
      setTitle('');
      setDueDate('');
      setEstimatedMinutes('');
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 99999 }} onClick={onCancel}>
      <div className="relative w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur opacity-50"></div>
          <div className="relative">
            <h2 className="text-2xl font-bold text-[#e0e0e0] mb-6">Quick Add Task</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="quick-add-project" className="block text-sm font-medium text-gray-400 mb-2">
                  Project *
                </label>
                <select
                  id="quick-add-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                >
                  {projects.length === 0 ? (
                    <option value="">No active projects</option>
                  ) : (
                    projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="quick-add-title" className="block text-sm font-medium text-gray-400 mb-2">
                  Task Title *
                </label>
                <input
                  id="quick-add-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to get done?"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>

              <div>
                <label htmlFor="quick-add-due-date" className="block text-sm font-medium text-gray-400 mb-2">
                  Due Date
                </label>
                <input
                  id="quick-add-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label htmlFor="quick-add-estimate" className="block text-sm font-medium text-gray-400 mb-2">
                  Estimated Minutes
                </label>
                <input
                  id="quick-add-estimate"
                  type="number"
                  min="1"
                  step="1"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-5 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-[#e0e0e0] font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || projects.length === 0}
                  className="px-5 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default QuickAddTaskForm;
