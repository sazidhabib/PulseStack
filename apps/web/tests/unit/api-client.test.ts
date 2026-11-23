import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '../../lib/api-client';

describe('ApiClient Unit Tests', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    apiClient.setAccessToken(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should store and include Authorization Bearer header when token is set', async () => {
    apiClient.setAccessToken('sample-token-123');

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockResolvedValue({ success: true, data: { status: 'ok' } }),
    } as any);

    const res = await apiClient.get('/api/test');

    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sample-token-123',
        }),
      })
    );
  });

  it('TRANSPARENT ROTATION: should automatically refresh access token and retry on 401', async () => {
    apiClient.setAccessToken('expired-token');

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (url.includes('/api/auth/refresh')) {
        // Refresh endpoint succeeds with newly rotated token
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              data: { accessToken: 'fresh-rotated-token-999' },
            }),
        });
      }

      if (callCount === 1) {
        // First attempt returns 401 Unauthorized
        return Promise.resolve({
          status: 401,
          json: () => Promise.resolve({ success: false, error: { message: 'Unauthorized' } }),
        });
      }

      // Second attempt (after refresh) succeeds with 200
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ success: true, data: { secretData: 42 } }),
      });
    });

    const res = await apiClient.get('/api/protected/resource');

    expect(res.success).toBe(true);
    expect(apiClient.getAccessToken()).toBe('fresh-rotated-token-999');
    expect(callCount).toBe(3); // 1: initial 401, 2: refresh, 3: replay with fresh token
  });

  it('should trigger onAuthFailure when refresh fails', async () => {
    const authFailureSpy = vi.fn();
    apiClient.onAuthFailure(authFailureSpy);

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/refresh')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ success: false }),
        });
      }
      return Promise.resolve({
        status: 401,
        json: () => Promise.resolve({ success: false }),
      });
    });

    await apiClient.get('/api/user/profile');

    expect(authFailureSpy).toHaveBeenCalled();
    expect(apiClient.getAccessToken()).toBeNull();
  });
});
