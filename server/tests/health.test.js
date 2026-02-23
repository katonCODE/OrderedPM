const request = require('supertest');
const { app } = require('../index');

describe('GET /api/health', () => {
  it('returns healthy status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      message: 'Server is running',
    });
  });
});
