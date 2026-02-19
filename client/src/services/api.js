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

    const normalizedMessage = String(errorMessage || '').toLowerCase();
    const isAuthError =
      response.status === 401 ||
      (response.status === 403 && (
        normalizedMessage.includes('invalid or expired token') ||
        normalizedMessage.includes('token expired')
      ));

    if (isAuthError) {
      const error = new Error(errorMessage || 'Session expired');
      error.status = response.status;
      error.originalRequest = originalRequest;
      error.isAuthError = true;
      throw error;
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
    if (error.isAuthError && error.originalRequest) {
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
      const { limit = 20, offset = 0, includeCount = false, includeArchived = false } = options;
      const params = new URLSearchParams();
      if (limit !== undefined) params.append('limit', limit.toString());
      if (offset !== undefined) params.append('offset', offset.toString());
      if (includeCount) params.append('includeCount', 'true');
      if (includeArchived) params.append('includeArchived', 'true');

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

  archive: async (id) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects/${id}/archive`, {
        method: 'POST',
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  unarchive: async (id) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects/${id}/unarchive`, {
        method: 'POST',
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  getShares: async (id) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects/${id}/shares`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  shareWithUsername: async (id, identifier, permissionLevel = 'editor') => {
    try {
      const isEmail = identifier.includes('@');
      const body = isEmail
        ? { email: identifier, permission_level: permissionLevel }
        : { username: identifier, permission_level: permissionLevel };
      return await fetchWithAuth(`${API_URL}/api/projects/${id}/shares`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  removeShare: async (id, sharedUserId) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/projects/${id}/shares/${sharedUserId}`, {
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
  getAllForUser: async () => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/user/all`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  search: async (q, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (q && typeof q === 'string') params.append('q', q.trim());
      if (options.limit != null) params.append('limit', options.limit);
      const url = `${API_URL}/api/tasks/search${params.toString() ? `?${params.toString()}` : ''}`;
      return await fetchWithAuth(url);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

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

  getToday: async () => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/today`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  generateTodayPlan: async ({ time_budget_minutes, pinned_task_ids = [], save = false } = {}) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/today/plan`, {
        method: 'POST',
        body: JSON.stringify({ time_budget_minutes, pinned_task_ids, save }),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  getActiveFocusSession: async () => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/focus/active`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  startFocusSession: async (taskId, { planned_minutes } = {}) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/focus/start`, {
        method: 'POST',
        body: JSON.stringify({ planned_minutes }),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  endFocusSession: async (taskId, sessionId, { outcome = 'progress', note = '' } = {}) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/focus/${sessionId}/end`, {
        method: 'POST',
        body: JSON.stringify({ outcome, note }),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  getFocusSessions: async (taskId, { limit = 10 } = {}) => {
    try {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append('limit', limit.toString());
      const url = `${API_URL}/api/tasks/${taskId}/focus/sessions${params.toString() ? `?${params.toString()}` : ''}`;
      return await fetchWithAuth(url);
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

  getSubtasks: async (taskId) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/subtasks`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  createSubtask: async (parentTaskId, data) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks`, {
        method: 'POST',
        body: JSON.stringify({ ...data, parent_task_id: parentTaskId }),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  getDependencies: async (taskId) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/dependencies`);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  addDependency: async (taskId, blockerTaskId) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/dependencies`, {
        method: 'POST',
        body: JSON.stringify({ blocker_task_id: blockerTaskId }),
      });
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the server is running.');
      }
      throw error;
    }
  },

  removeDependency: async (taskId, blockerTaskId) => {
    try {
      return await fetchWithAuth(`${API_URL}/api/tasks/${taskId}/dependencies/${blockerTaskId}`, {
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

