import { HttpMethod, PingResult } from '@pulsestack/shared';

export interface PingOptions {
  method?: HttpMethod;
  timeout?: number;
  expectedStatus?: number;
  headers?: Record<string, string>;
}

export async function httpPing(
  url: string,
  options: PingOptions = {}
): Promise<PingResult> {
  const {
    method = 'GET',
    timeout = 30000,
    expectedStatus = 200,
    headers = {},
  } = options;

  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'PulseStack-Health-Monitor/1.0',
        ...headers,
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const statusCode = response.status;

    let status: 'up' | 'down' | 'degraded';
    let error: string | null = null;

    if (statusCode === expectedStatus) {
      status = 'up';
    } else if (statusCode >= 200 && statusCode < 400) {
      // Returned a 2xx/3xx but not exact expected status
      status = 'degraded';
      error = `Expected HTTP ${expectedStatus}, received HTTP ${statusCode}`;
    } else {
      // 4xx or 5xx
      status = 'down';
      error = `HTTP ${statusCode} ${response.statusText}`;
    }

    return {
      statusCode,
      latencyMs,
      status,
      error,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));

    let errorMessage = 'Network error';

    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      errorMessage = `Connection timed out after ${timeout}ms`;
    } else if (err.cause?.code) {
      errorMessage = `${err.cause.code}: ${err.message}`;
    } else if (err.message) {
      errorMessage = err.message;
    }

    return {
      statusCode: null,
      latencyMs,
      status: 'down',
      error: errorMessage,
    };
  }
}
