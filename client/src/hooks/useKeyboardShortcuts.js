// client/src/hooks/useKeyboardShortcuts.js
import { useEffect, useRef } from 'react';

/**
 * Custom hook for handling keyboard shortcuts
 * @param {Object} shortcuts - Object mapping key combinations to callbacks
 * @param {Array} deps - Dependencies array (shortcuts are re-registered when deps change)
 * @param {boolean} enabled - Whether shortcuts are enabled (default: true)
 * 
 * @example
 * useKeyboardShortcuts({
 *   'c': () => handleCreate(),
 *   '/': (e) => { e.preventDefault(); searchRef.current?.focus(); },
 *   'Escape': () => handleClose()
 * }, [handleCreate, handleClose], true);
 */
export function useKeyboardShortcuts(shortcuts, deps = [], enabled = true) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when user is typing in inputs, textareas, or contenteditable elements
      const target = e.target;
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]');

      // Allow Escape key even when typing
      if (e.key === 'Escape') {
        const handler = shortcutsRef.current['Escape'];
        if (handler) {
          handler(e);
        }
        return;
      }

      // Skip other shortcuts if typing
      if (isInput) return;

      // Handle key combinations
      const key = e.key.toLowerCase();
      const handler = shortcutsRef.current[key];

      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, ...deps]);
}

export default useKeyboardShortcuts;
