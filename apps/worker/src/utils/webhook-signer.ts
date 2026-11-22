import crypto from 'crypto';

export function signWebhookPayload(payload: unknown, secret: string): string {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(content).digest('hex');
}

export function verifyWebhookSignature(
  payload: unknown,
  secret: string,
  signature: string
): boolean {
  const expected = signWebhookPayload(payload, secret);
  if (expected.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
