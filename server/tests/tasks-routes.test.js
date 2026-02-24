const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const pool = require('../db/connection');
const tasksRouter = require('../routes/tasks');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', tasksRouter);
  return app;
};

const createToken = (sub = 'user-1') =>
  jwt.sign({ sub, email: `${sub}@example.com` }, process.env.SUPABASE_JWT_SECRET);

describe('tasks routes CRUD and validation', () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = 'test-secret';
    vi.spyOn(pool, 'query');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires either project_id or parent_task_id on create', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({ title: 'Task without project' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Either Project ID or Parent Task ID is required' });
  });

  it('validates recurrence_type on create', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'project-1', user_id: 'user-1', permission_level: null }],
    });

    const app = buildApp();
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        project_id: 'project-1',
        title: 'Recurring task',
        recurrence_type: 'yearly',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid recurrence type. Must be daily, weekly, or monthly',
    });
  });

  it('creates a task when payload and permissions are valid', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'project-1', user_id: 'user-1', permission_level: null }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'task-1', project_id: 'project-1', title: 'New Task', status: 'todo' }],
      });

    const app = buildApp();
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({
        project_id: 'project-1',
        title: ' New Task ',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 'task-1', title: 'New Task' });
  });

  it('rejects invalid status values on update', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'task-1', project_id: 'project-1', status: 'todo' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'project-1', user_id: 'user-1', permission_level: null }],
      });

    const app = buildApp();
    const response = await request(app)
      .put('/api/tasks/task-1')
      .set('Authorization', `Bearer ${createToken()}`)
      .send({ status: 'invalid_status' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid status value' });
  });

  it('blocks task deletion for users without delete permission', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'task-1', project_id: 'project-1' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'project-1', user_id: 'owner-1', permission_level: 'viewer' }],
      });

    const app = buildApp();
    const response = await request(app)
      .delete('/api/tasks/task-1')
      .set('Authorization', `Bearer ${createToken('user-2')}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'You do not have permission to delete tasks in this project',
    });
  });
});
