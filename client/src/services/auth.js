// client/src/services/auth.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Using mock auth.');
}

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
      localStorage.setItem('token', data.session.access_token);
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
      localStorage.setItem('token', data.session.access_token);
    }
    return data;
  },

  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('token');
  },

  getSession: async () => {
    if (!supabase) {
      const token = localStorage.getItem('token');
      return token ? { access_token: token } : null;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      localStorage.setItem('token', data.session.access_token);
      return data.session;
    }
    return null;
  },

  onAuthStateChange: (callback) => {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabase.auth.onAuthStateChange(callback);
  },
};

