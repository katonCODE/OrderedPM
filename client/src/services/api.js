// client/src/services/api.js
import { authService } from './auth';
import { getAccessToken, clearTokens } from '../utils/token';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

let isRefreshing = false;
let refreshPromise = null;

const getAuthHeaders = () => {
  const token = getAccessToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
  
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
      clearTokens();
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
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
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
        clearTokens();
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
  getAll: async (options = {}) => {
    try {
      const { limit = 20, offset = 0, includeCount = false } = options;
      const params = new URLSearchParams();
      if (limit !== undefined) params.append('limit', limit.toString());
      if (offset !== undefined) params.append('offset', offset.toString());
      if (includeCount) params.append('includeCount', 'true');
      
      const url = `${API_URL}/api/projects${params.toString() ? `?${params.toString()}` : ''}`;
      return await fetchWithAuth(url);
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
  getByProject: async (projectId, options = {}) => {
    try {
      const { limit = 50, offset = 0 } = options;
      const params = new URLSearchParams();
      if (limit !== undefined) params.append('limit', limit.toString());
      if (offset !== undefined) params.append('offset', offset.toString());
      
      const url = `${API_URL}/api/tasks/project/${projectId}${params.toString() ? `?${params.toString()}` : ''}`;
      return await fetchWithAuth(url);
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

  generateTask: async (prompt, projectId) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/ai/generate`, {
        method: 'POST',
        body: JSON.stringify({ prompt, project_id: projectId }),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },
};

