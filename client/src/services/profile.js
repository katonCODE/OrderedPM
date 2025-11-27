// client/src/services/profile.js
import { authService } from './auth';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const getAuthHeaders = () => {
  let token = localStorage.getItem('token');
  
  // Try to get token from Supabase's localStorage format if not found
  if (!token) {
    const supabaseKey = Object.keys(localStorage).find(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );
    if (supabaseKey) {
      try {
        const authData = JSON.parse(localStorage.getItem(supabaseKey));
        if (authData && authData.access_token) {
          token = authData.access_token;
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    }
  }
  
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const fetchWithAuth = async (url, options = {}) => {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      }
    } catch (parseError) {
      // If parsing fails, use the status-based message
    }
    
    throw new Error(errorMessage);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return null;
};

// Get public profile by username
export const getProfileByUsername = async (username) => {
  try {
    const response = await fetch(`${API_URL}/api/profiles/${username}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Profile not found');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check if the server is running.');
    }
    throw error;
  }
};

// Get current user's profile
export const getMyProfile = async () => {
  try {
    return await fetchWithAuth(`${API_URL}/api/profiles/me`);
  } catch (error) {
    // Handle 404 - profile doesn't exist yet
    if (error.message.includes('404') || 
        error.message.includes('Profile not found') || 
        error.message.includes('Not Found')) {
      return null; // Return null instead of throwing
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check if the server is running.');
    }
    throw error;
  }
};

// Update current user's profile
export const updateProfile = async (profileData) => {
  try {
    return await fetchWithAuth(`${API_URL}/api/profiles/me`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check if the server is running.');
    }
    throw error;
  }
};

