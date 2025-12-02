// client/src/services/auth.js
import { supabase } from './supabase';
import { syncToken, clearTokens, getSupabaseAuthKey, getAccessToken } from '../utils/token';

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
    clearTokens();
  },

  getSession: async () => {
    if (!supabase) {
      const token = getAccessToken();
      return token ? { access_token: token } : null;
    }
    
    const token = getAccessToken();
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

