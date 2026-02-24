const request = require('supertest');
const { app } = require('../index');

describe('CORS behavior', () => {
  it('allows requests from configured origins', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('blocks requests from unknown origins', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://blocked-origin.example');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Something went wrong!' });
  });
});
