import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksAPI } from '../services/api';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function GlobalTaskSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setOpen(debouncedQuery.length > 0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    tasksAPI
      .search(debouncedQuery, { limit: 20 })
      .then((res) => {
        if (!cancelled) {
          setResults(res.data || []);
          setOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSelect = (task) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    navigate(`/project/${task.project_id}`, { state: { openTaskId: task.id } });
  };

  const statusLabel = (s) => (s === 'done' ? 'Done' : s === 'in_progress' ? 'In progress' : 'To do');
  const formatDue = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="relative w-full max-w-md z-[120]" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= MIN_QUERY_LENGTH && setOpen(true)}
        placeholder="Search tasks..."
        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
        aria-label="Search tasks"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#252525] border border-white/10 rounded-lg shadow-xl max-h-80 overflow-y-auto z-[220]">
          {loading && (
            <div className="px-4 py-3 text-gray-400 text-sm">Searching...</div>
          )}
          {!loading && debouncedQuery.length > 0 && debouncedQuery.length < MIN_QUERY_LENGTH && (
            <div className="px-4 py-3 text-gray-400 text-sm">Type at least 2 characters</div>
          )}
          {!loading && debouncedQuery.length >= MIN_QUERY_LENGTH && results.length === 0 && (
            <div className="px-4 py-3 text-gray-400 text-sm">No tasks found</div>
          )}
          {!loading &&
            results.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => handleSelect(task)}
                className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
              >
                <div className="font-medium text-[#e0e0e0] truncate">{task.title}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span>{task.project_name}</span>
                  <span>·</span>
                  <span>{statusLabel(task.status)}</span>
                  {task.due_date && (
                    <>
                      <span>·</span>
                      <span>{formatDue(task.due_date)}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default GlobalTaskSearch;
