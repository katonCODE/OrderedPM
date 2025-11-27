// client/src/services/auth.js
import { supabase, supabaseUrl } from './supabase';

const getSupabaseAuthKey = () => {
  if (!supabaseUrl) return null;
  const urlParts = supabaseUrl.split('//')[1]?.split('.')[0];
  if (urlParts) {
    return `sb-${urlParts}-auth-token`;
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
      return key;
    }
  }
  return null;
};

const syncToken = (accessToken) => {
  if (!accessToken) return;
  
  // Store in our token key for backward compatibility
  localStorage.setItem('token', accessToken);
  
  // Also sync to Supabase's format if Supabase is configured
  if (supabase) {
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
  }
};

export const authService = {
  signUp: async (email, password) => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    if (data.session) {
      syncToken(data.session.access_token);
    }
    return data;
  },

  signIn: async (email, password) => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.session) {
      syncToken(data.session.access_token);
    }
    return data;
  },

  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('token');
    // Also clear Supabase auth token
    const supabaseKey = getSupabaseAuthKey();
    if (supabaseKey) {
      localStorage.removeItem(supabaseKey);
    }
  },

  getSession: async () => {
    if (!supabase) {
      const token = localStorage.getItem('token');
      return token ? { access_token: token } : null;
    }
    
    const token = localStorage.getItem('token');
    let { data } = await supabase.auth.getSession();
    
    if (data.session) {
      syncToken(data.session.access_token);
      return data.session;
    }
    
    if (token) {
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)));
        const retryData = await supabase.auth.getSession();
        if (retryData.data.session) {
          syncToken(retryData.data.session.access_token);
          return retryData.data.session;
        }
      }
    }
    
    return null;
  },

  resendConfirmationEmail: async (email) => {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
  },

  refreshSession: async () => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    if (data.session) {
      syncToken(data.session.access_token);
      return data.session;
    }
    throw new Error('No session available to refresh');
  },

  onAuthStateChange: (callback) => {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabase.auth.onAuthStateChange(callback);
  },
};

