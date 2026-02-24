import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearTokens,
  getAccessToken,
  getSupabaseAuthKey,
  syncToken,
} from '../src/utils/token';

describe('token utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns token from legacy token key first', () => {
    localStorage.setItem('token', 'legacy-token');
    localStorage.setItem('sb-demo-auth-token', JSON.stringify({ access_token: 'supabase-token' }));

    expect(getAccessToken()).toBe('legacy-token');
  });

  it('detects supabase auth key using fallback scan', () => {
    localStorage.setItem('sb-demo-auth-token', JSON.stringify({ access_token: 'token-1' }));

    expect(getSupabaseAuthKey()).toBe('sb-demo-auth-token');
  });

  it('reads access token from supabase auth payload', () => {
    localStorage.setItem('sb-demo-auth-token', JSON.stringify({ access_token: 'supabase-token' }));

    expect(getAccessToken()).toBe('supabase-token');
  });

  it('syncs and clears tokens across storage formats', () => {
    localStorage.setItem('sb-demo-auth-token', JSON.stringify({ refresh_token: 'refresh-1' }));

    syncToken('new-access-token');

    expect(localStorage.getItem('token')).toBe('new-access-token');
    expect(localStorage.getItem('sb-demo-auth-token')).toBe(
      JSON.stringify({ refresh_token: 'refresh-1', access_token: 'new-access-token' }),
    );

    clearTokens();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('sb-demo-auth-token')).toBeNull();
  });
});
