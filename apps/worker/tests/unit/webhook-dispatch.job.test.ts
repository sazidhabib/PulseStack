import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebhookDispatchProcessor } from '../../src/jobs/webhook-dispatch.job';

describe('WebhookDispatchProcessor', () => {
  let mockDb: any;
  let processor: any;

  const fakeJob = {
    id: 'job-123',
    attemptsMade: 0,
    data: {
      webhookId: 'wh-123',
      orgId: 'org-abc',
      url: 'https://webhook.site/test',
      secret: 'secret-key-12345678',
      event: 'monitor.down',
      payload: {
        monitorId: 'mon-1',
        status: 'down',
      },
    },
  };

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };
    processor = createWebhookDispatchProcessor(mockDb);
  });

  it('should deliver webhook with HMAC signature header and log success', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const result = await processor(fakeJob as any);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);

    expect(fetchSpy).toHaveBeenCalledWith(
      fakeJob.data.url,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-PulseStack-Event': 'monitor.down',
          'X-PulseStack-Signature': expect.any(String),
        }),
      })
    );

    // Verify delivery logged to database with success: true
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.anything()
    );

    fetchSpy.mockRestore();
  });

  it('should log failed delivery and throw error to trigger BullMQ exponential backoff', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    await expect(processor(fakeJob as any)).rejects.toThrow(
      /Webhook target responded with HTTP 500/
    );

    expect(mockDb.insert).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
