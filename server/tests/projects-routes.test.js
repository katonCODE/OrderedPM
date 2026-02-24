const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const pool = require('../db/connection');
const projectsRouter = require('../routes/projects');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/projects', projectsRouter);
  return app;
};

const createToken = (sub = 'user-1') =>
  jwt.sign({ sub, email: `${sub}@example.com` }, process.env.SUPABASE_JWT_SECRET);

describe('projects routes permissions and sharing', () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = 'test-secret';
    vi.spyOn(pool, 'query');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks updating project details for non-owners', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'project-1', user_id: 'owner-1', permission_level: 'editor' }],
    });

    const app = buildApp();
    const response = await request(app)
      .put('/api/projects/project-1')
      .set('Authorization', `Bearer ${createToken('user-1')}`)
      .send({ name: 'Updated name' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Only the project owner can edit project details' });
  });

  it('blocks sharing for collaborators without admin rights', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'project-1', user_id: 'owner-1', permission_level: 'editor' }],
    });

    const app = buildApp();
    const response = await request(app)
      .post('/api/projects/project-1/shares')
      .set('Authorization', `Bearer ${createToken('user-1')}`)
      .send({ username: 'teammate', permission_level: 'viewer' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Only project owners or admins can share this project' });
  });

  it('allows admin collaborators to share with viewer permission', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'project-1', user_id: 'owner-1', permission_level: 'admin' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'user-2', username: 'teammate', full_name: 'Teammate Name', avatar_url: null }],
      })
      .mockResolvedValueOnce({
        rows: [{ user_id: 'owner-1' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const app = buildApp();
    const response = await request(app)
      .post('/api/projects/project-1/shares')
      .set('Authorization', `Bearer ${createToken('user-1')}`)
      .send({ username: 'teammate', permission_level: 'viewer' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user_id: 'user-2',
      username: 'teammate',
      full_name: 'Teammate Name',
      avatar_url: null,
      permission_level: 'viewer',
    });
  });

  it('prevents admins from assigning admin permission to others', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'project-1', user_id: 'owner-1', permission_level: 'admin' }],
    });

    const app = buildApp();
    const response = await request(app)
      .post('/api/projects/project-1/shares')
      .set('Authorization', `Bearer ${createToken('user-1')}`)
      .send({ username: 'teammate', permission_level: 'admin' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Admins can only assign viewer or editor permissions' });
  });
});
