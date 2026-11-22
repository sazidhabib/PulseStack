import { describe, it, expect, vi, afterEach } from 'vitest';
import { httpPing } from '../../src/utils/http-ping';

describe('httpPing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return status "up" when status matches expectedStatus', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      ok: true,
    } as any);

    const result = await httpPing('https://api.test.com/health', {
      expectedStatus: 200,
    });

    expect(result.status).toBe('up');
    expect(result.statusCode).toBe(200);
    expect(result.latencyMs).toBeGreaterThan(0);
    expect(result.error).toBeNull();
  });

  it('should return status "degraded" when status is 2xx/3xx but not expected', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      status: 204,
      statusText: 'No Content',
      ok: true,
    } as any);

    const result = await httpPing('https://api.test.com/health', {
      expectedStatus: 200,
    });

    expect(result.status).toBe('degraded');
    expect(result.statusCode).toBe(204);
    expect(result.error).toContain('Expected HTTP 200, received HTTP 204');
  });

  it('should return status "down" on HTTP 500 error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      status: 503,
      statusText: 'Service Unavailable',
      ok: false,
    } as any);

    const result = await httpPing('https://api.test.com/health');

    expect(result.status).toBe('down');
    expect(result.statusCode).toBe(503);
    expect(result.error).toContain('HTTP 503 Service Unavailable');
  });

  it('should handle request abort / timeout gracefully', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    vi.spyOn(global, 'fetch').mockRejectedValue(abortError);

    const result = await httpPing('https://slow-api.test.com/health', {
      timeout: 1000,
    });

    expect(result.status).toBe('down');
    expect(result.statusCode).toBeNull();
    expect(result.error).toContain('timed out after 1000ms');
  });
});
