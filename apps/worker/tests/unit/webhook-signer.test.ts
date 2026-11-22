import { describe, it, expect } from 'vitest';
import {
  signWebhookPayload,
  verifyWebhookSignature,
} from '../../src/utils/webhook-signer';

describe('WebhookSigner', () => {
  const secret = 'super-secret-key-1234567890';
  const payload = {
    event: 'monitor.down',
    monitorId: 'm-123',
    timestamp: '2026-11-22T12:00:00Z',
  };

  it('should generate a 64-char hex HMAC-SHA256 signature', () => {
    const signature = signWebhookPayload(payload, secret);
    expect(typeof signature).toBe('string');
    expect(signature.length).toBe(64);
  });

  it('should verify signature successfully for matching payload & secret', () => {
    const signature = signWebhookPayload(payload, secret);
    const isValid = verifyWebhookSignature(payload, secret, signature);
    expect(isValid).toBe(true);
  });

  it('should reject signature if payload has been tampered with', () => {
    const signature = signWebhookPayload(payload, secret);
    const tamperedPayload = { ...payload, monitorId: 'm-tampered' };
    const isValid = verifyWebhookSignature(tamperedPayload, secret, signature);
    expect(isValid).toBe(false);
  });

  it('should reject signature if wrong secret is used', () => {
    const signature = signWebhookPayload(payload, secret);
    const isValid = verifyWebhookSignature(payload, 'wrong-secret', signature);
    expect(isValid).toBe(false);
  });
});
