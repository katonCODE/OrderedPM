// client/src/hooks/useRealtimeSubscription.js
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

/**
 * Hook to subscribe to Supabase Realtime changes and automatically update React Query cache
 * 
 * @param {string} table - Table name to subscribe to (e.g., 'projects', 'tasks')
 * @param {object} options - Configuration options
 * @param {string} options.filter - Optional filter (e.g., 'project_id=eq.123')
 * @param {function} options.onInsert - Callback for INSERT events
 * @param {function} options.onUpdate - Callback for UPDATE events
 * @param {function} options.onDelete - Callback for DELETE events
 * @param {array} options.queryKeys - React Query keys to invalidate on changes
 * @param {boolean} options.enabled - Whether subscription is enabled (default: true)
 */
export function useRealtimeSubscription(table, options = {}) {
  const queryClient = useQueryClient();
  const channelRef = useRef(null);
  const callbacksRef = useRef({
    onInsert: null,
    onUpdate: null,
    onDelete: null,
  });
  const queryKeysRef = useRef([]);
  const {
    filter,
    onInsert,
    onUpdate,
    onDelete,
    queryKeys = [],
    enabled = true,
  } = options;

  // Keep latest callbacks/query keys without forcing channel re-subscribe every render.
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete };
    queryKeysRef.current = Array.isArray(queryKeys) ? queryKeys : [];
  }, [onInsert, onUpdate, onDelete, queryKeys]);

  useEffect(() => {
    if (!enabled || !supabase || !table) {
      return;
    }

    let cancelled = false;

    const startSubscription = async () => {
      try {
        // Bind realtime auth only when Supabase session token is available.
        const { data } = await supabase.auth.getSession();
        const sessionToken = data?.session?.access_token;
        if (sessionToken) {
          supabase.realtime.setAuth(sessionToken);
        }
      } catch (error) {
        // If session lookup fails, continue subscription setup and let channel status logging expose issues.
        console.error('Realtime session lookup failed:', error);
      }

      if (cancelled) return;

      // Cleanup previous subscription if it exists
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Create a channel for this subscription
      const channelName = filter
        ? `${table}:${filter.replace(/[^a-zA-Z0-9]/g, '_')}`
        : `${table}:all`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            ...(filter && { filter }),
          },
          (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;

            // Invalidate React Query cache for specified keys
            queryKeysRef.current.forEach(queryKey => {
              queryClient.invalidateQueries({ queryKey });
            });

            // Call custom callbacks if provided
            const { onInsert: insertCb, onUpdate: updateCb, onDelete: deleteCb } = callbacksRef.current;
            if (eventType === 'INSERT' && insertCb) {
              insertCb(newRecord);
            } else if (eventType === 'UPDATE' && updateCb) {
              updateCb(newRecord, oldRecord);
            } else if (eventType === 'DELETE' && deleteCb) {
              deleteCb(oldRecord);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Realtime subscription active for ${table}`);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.error(`❌ Realtime subscription status for ${table}: ${status}`);
          }
        });

      channelRef.current = channel;
    };

    startSubscription();

    // Cleanup subscription on unmount
    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, enabled, queryClient]);

  return channelRef.current;
}
