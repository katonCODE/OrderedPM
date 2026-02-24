import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { refreshSessionMock } = vi.hoisted(() => ({ refreshSessionMock: vi.fn() }));
vi.mock('../src/services/auth', () => ({
  authService: {
    refreshSession: refreshSessionMock,
  },
}));

import { projectsAPI } from '../src/services/api';

const jsonResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {
    get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
  },
  json: async () => data,
  text: async () => JSON.stringify(data),
});

describe('projectsAPI', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    refreshSessionMock.mockReset();
  });

  it('builds query params for getAll options', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ projects: [], totalCount: 0 }) as never,
    );

    await projectsAPI.getAll({
      limit: 10,
      offset: 20,
      includeCount: true,
      includeArchived: true,
    });

    const [url, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(String(url)).toContain('/api/projects?limit=10&offset=20&includeCount=true&includeArchived=true');
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    });
  });

  it('uses email payload for shareWithUsername when identifier is email', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ success: true }) as never);

    await projectsAPI.shareWithUsername('project-1', 'person@example.com', 'viewer');

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual({
      email: 'person@example.com',
      permission_level: 'viewer',
    });
  });

  it('uses username payload for shareWithUsername when identifier is not an email', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ success: true }) as never);

    await projectsAPI.shareWithUsername('project-1', 'daniel', 'editor');

    const [, options] = vi.mocked(global.fetch).mock.calls[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      username: 'daniel',
      permission_level: 'editor',
    });
  });

  it('retries request after token refresh on auth errors', async () => {
    refreshSessionMock.mockResolvedValueOnce({ access_token: 'refreshed-token' });
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Invalid or expired token' }, 401) as never,
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'project-1', name: 'Test Project' }] }) as never,
      );

    const result = await projectsAPI.getAll();

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: [{ id: 'project-1', name: 'Test Project' }] });
  });

  it('clears tokens and throws session-expired error when refresh fails', async () => {
    refreshSessionMock.mockRejectedValueOnce(new Error('refresh failed'));
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'Invalid or expired token' }, 403) as never,
    );

    await expect(projectsAPI.getAll()).rejects.toThrow('Session expired. Please log in again.');

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('token')).toBeNull();
  });
});
