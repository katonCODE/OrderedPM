// client/src/components/MentionAutocomplete.jsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { tasksAPI } from '../services/api';

function MentionAutocomplete({ taskId, value, onChange, onBlur, placeholder, rows = 3, disabled = false }) {
  const textareaRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);

  useEffect(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const pos = textarea.selectionStart;
    setCursorPosition(pos);

    const textBeforeCursor = value.substring(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasSpaceOrNewline = /[\s\n]/.test(textAfterAt);

      if (!hasSpaceOrNewline) {
        setMentionStart(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionQuery('');
    setMentionStart(-1);
  }, [value]);

  const { data: candidatesData, isLoading: isLoadingCandidates } = useQuery({
    queryKey: ['mention-candidates', taskId, mentionQuery],
    queryFn: () => tasksAPI.searchMentionCandidates(taskId, mentionQuery),
    enabled: !!taskId && showSuggestions && mentionStart !== -1,
    staleTime: 30000,
  });

  const candidates = candidatesData?.data || [];

  const insertMention = (username) => {
    if (mentionStart === -1) return;

    const textBefore = value.substring(0, mentionStart);
    const textAfter = value.substring(cursorPosition);
    const newValue = `${textBefore}@${username} ${textAfter}`;

    onChange({ target: { value: newValue } });

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + username.length + 2;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);

    setShowSuggestions(false);
    setMentionQuery('');
    setMentionStart(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || candidates.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (candidates[selectedIndex]) {
        insertMention(candidates[selectedIndex].username);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (candidate) => {
    insertMention(candidate.username);
  };

  const getUserName = (candidate) => candidate.full_name || candidate.username || 'Unknown';
  const getUserInitials = (candidate) => {
    const name = getUserName(candidate);
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!textareaRef.current || mentionStart === -1 || !showSuggestions) {
      return;
    }

    const updatePosition = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const rect = textarea.getBoundingClientRect();
      const textBeforeCursor = value.substring(0, mentionStart);
      const lines = textBeforeCursor.split('\n');
      const lineNumber = lines.length - 1;
      const lineText = lines[lineNumber] || '';

      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      div.style.whiteSpace = 'pre-wrap';
      div.style.width = textarea.offsetWidth + 'px';
      div.style.font = window.getComputedStyle(textarea).font;
      div.style.padding = window.getComputedStyle(textarea).padding;
      div.style.border = window.getComputedStyle(textarea).border;
      div.style.boxSizing = 'border-box';
      div.textContent = lineText;
      document.body.appendChild(div);

      const textWidth = Math.min(div.offsetWidth, textarea.offsetWidth);
      document.body.removeChild(div);

      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
      const paddingTop = parseInt(window.getComputedStyle(textarea).paddingTop) || 0;
      const paddingLeft = parseInt(window.getComputedStyle(textarea).paddingLeft) || 0;

      setMentionPosition({
        top: rect.top + paddingTop + (lineNumber + 1) * lineHeight,
        left: rect.left + paddingLeft + textWidth,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [mentionStart, showSuggestions, value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e);
        }}
        onBlur={(e) => {
          setTimeout(() => {
            if (!document.activeElement?.closest('.mention-suggestions')) {
              setShowSuggestions(false);
            }
          }, 200);
          if (onBlur) onBlur(e);
        }}
        onKeyDown={handleKeyDown}
        onSelect={(e) => {
          const textarea = e.target;
          setCursorPosition(textarea.selectionStart);
        }}
        onClick={(e) => {
          const textarea = e.target;
          setCursorPosition(textarea.selectionStart);
        }}
        onInput={(e) => {
          const textarea = e.target;
          setCursorPosition(textarea.selectionStart);
        }}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-[#e0e0e0] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
      />
      {showSuggestions && mentionStart !== -1 && createPortal(
        <div
          className="mention-suggestions fixed bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl overflow-hidden min-w-[200px] max-w-[300px] max-h-[200px] overflow-y-auto"
          style={{
            top: `${Math.max(0, mentionPosition.top)}px`,
            left: `${Math.max(0, mentionPosition.left)}px`,
            zIndex: 100000,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {isLoadingCandidates ? (
            <div className="p-2 text-xs text-gray-400">Loading...</div>
          ) : candidates.length === 0 ? (
            <div className="p-2 text-xs text-gray-400">No users found</div>
          ) : (
            candidates.map((candidate, index) => (
              <div
                key={candidate.id}
                onClick={() => handleSelect(candidate)}
                className={`flex items-center gap-2 p-2 cursor-pointer transition-all ${index === selectedIndex
                  ? 'bg-blue-500/30 border-l-2 border-blue-400'
                  : 'hover:bg-white/10'
                  }`}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {candidate.avatar_url ? (
                  <img
                    src={candidate.avatar_url}
                    alt={getUserName(candidate)}
                    className="w-8 h-8 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 text-xs text-gray-300 flex items-center justify-center font-semibold">
                    {getUserInitials(candidate)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#e0e0e0] truncate">
                    {getUserName(candidate)}
                  </div>
                  <div className="text-xs text-gray-400 truncate">@{candidate.username}</div>
                </div>
              </div>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export default MentionAutocomplete;
