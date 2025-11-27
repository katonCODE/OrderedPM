// client/src/services/api.js
import { authService } from './auth';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

let isRefreshing = false;
let refreshPromise = null;

const getSupabaseToken = () => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
      try {
        const authData = JSON.parse(localStorage.getItem(key));
        if (authData && authData.access_token) {
          return authData.access_token;
        }
      } catch (e) {
        // Invalid JSON, continue searching
      }
    }
  }
  return null;
};

const getAuthHeaders = () => {
  let token = localStorage.getItem('token');
  
  // Try to get token from Supabase's localStorage format if not found
  if (!token) {
    token = getSupabaseToken();
  }
  
  // Debug logging
  if (import.meta.env.DEV) {
    console.log('[API] Token retrieved:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN FOUND');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
  
  if (import.meta.env.DEV) {
    console.log('[API] Headers being sent:', { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'NOT SET' });
  }
  
  return headers;
};

const refreshToken = async () => {
  if (isRefreshing) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = authService.refreshSession()
    .then((session) => {
      isRefreshing = false;
      refreshPromise = null;
      return session;
    })
    .catch((error) => {
      isRefreshing = false;
      refreshPromise = null;
      localStorage.removeItem('token');
      throw error;
    });
  
  return refreshPromise;
};

const handleResponse = async (response, originalRequest) => {
  if (!response.ok) {
    if (response.status === 403) {
      const error = new Error('Token expired');
      error.status = 403;
      error.originalRequest = originalRequest;
      throw error;
    }
    
    const contentType = response.headers.get('content-type');
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } else {
        const text = await response.text();
        if (text) {
          errorMessage = `${errorMessage} - ${text}`;
        }
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
  
  const text = await response.text();
  return text ? text : null;
};

const fetchWithAuth = async (url, options = {}) => {
  const makeRequest = async () => {
    const headers = {
      ...getAuthHeaders(),
      ...options.headers,
    };
    
    if (import.meta.env.DEV) {
      console.log('[API] Making request to:', url);
      console.log('[API] Request headers:', { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'NOT SET' });
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (import.meta.env.DEV) {
      console.log('[API] Response status:', response.status, response.statusText);
    }
    
    return handleResponse(response, { url, options });
  };
  
  try {
    return await makeRequest();
  } catch (error) {
    if (error.status === 403 && error.originalRequest) {
      try {
        await refreshToken();
        return await makeRequest();
      } catch (refreshError) {
        localStorage.removeItem('token');
        // Also clear Supabase auth token
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
            break;
          }
        }
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }
    }
    throw error;
  }
};

// Auth API
export const authAPI = {
  getMe: async () => {
    try {
      return await fetchWithAuth(`${API_URL}/api/auth/me`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },
};

// Projects API
export const projectsAPI = {
  getAll: async () => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  getById: async (id) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects/${id}`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  create: async (data) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  delete: async (id) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },
};

// Tasks API
export const tasksAPI = {
  getByProject: async (projectId) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/project/${projectId}`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  getById: async (id) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${id}`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  create: async (data) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  delete: async (id) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },
};

