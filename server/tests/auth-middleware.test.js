const jwt = require('jsonwebtoken');
const authenticateToken = require('../middleware/auth');

const createResponse = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('authenticateToken middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when authorization header is missing', () => {
    const req = { headers: {} };
    const res = createResponse();
    const next = vi.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when token verification fails', () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = createResponse();
    const next = vi.fn();
    vi.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('invalid token');
    });

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req user data and calls next for valid token', () => {
    const decoded = { sub: 'user-123', role: 'user' };
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = createResponse();
    const next = vi.fn();
    vi.spyOn(jwt, 'verify').mockReturnValue(decoded);

    authenticateToken(req, res, next);

    expect(req.user).toEqual(decoded);
    expect(req.userId).toBe('user-123');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
