// client/src/utils/token.js
import { supabaseUrl } from '../services/supabase';

/**
 * Gets the Supabase auth key from localStorage
 * @returns {string|null} The Supabase auth key or null if not found
 */
export const getSupabaseAuthKey = () => {
  if (supabaseUrl) {
    const urlParts = supabaseUrl.split('//')[1]?.split('.')[0];
    if (urlParts) {
      const expectedKey = `sb-${urlParts}-auth-token`;
      if (localStorage.getItem(expectedKey)) {
        return expectedKey;
      }
    }
  }
  
  // Fallback: search for any Supabase auth token key
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
      return key;
    }
  }
  
  return null;
};

/**
 * Gets the access token from localStorage
 * Checks both the 'token' key and Supabase's localStorage format
 * @returns {string|null} The access token or null if not found
 */
export const getAccessToken = () => {
  // First, try the standard 'token' key
  let token = localStorage.getItem('token');
  if (token) {
    return token;
  }
  
  // Try to get token from Supabase's localStorage format
  const supabaseKey = getSupabaseAuthKey();
  if (supabaseKey) {
    try {
      const authData = JSON.parse(localStorage.getItem(supabaseKey));
      if (authData && authData.access_token) {
        return authData.access_token;
      }
    } catch (e) {
      // Invalid JSON, continue
    }
  }
  
  return null;
};

/**
 * Syncs an access token to both storage formats for backward compatibility
 * @param {string} accessToken - The access token to sync
 */
export const syncToken = (accessToken) => {
  if (!accessToken) return;
  
  // Store in our token key for backward compatibility
  localStorage.setItem('token', accessToken);
  
  // Also sync to Supabase's format if Supabase is configured
  const supabaseKey = getSupabaseAuthKey();
  if (supabaseKey) {
    try {
      const existingData = localStorage.getItem(supabaseKey);
      let authData = existingData ? JSON.parse(existingData) : {};
      authData.access_token = accessToken;
      localStorage.setItem(supabaseKey, JSON.stringify(authData));
    } catch (e) {
      // If parsing fails, create new structure
      localStorage.setItem(supabaseKey, JSON.stringify({ access_token: accessToken }));
    }
  }
};

/**
 * Clears all authentication tokens from localStorage
 */
export const clearTokens = () => {
  localStorage.removeItem('token');
  
  const supabaseKey = getSupabaseAuthKey();
  if (supabaseKey) {
    localStorage.removeItem(supabaseKey);
  }
};

