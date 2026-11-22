import Redis from 'ioredis';
import { WsManager } from './ws-manager';
import { WsEvent } from '@pulsestack/shared';
import { env } from '../config/env';

export class RedisSubscriber {
  private redis: Redis;
  private wsManager: WsManager;
  private isConnected = false;

  constructor(wsManager: WsManager, redisClient?: Redis) {
    this.wsManager = wsManager;
    this.redis =
      redisClient ??
      new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
  }

  /**
   * Connect to Redis and subscribe to health-check events pattern.
   */
  public async start(): Promise<void> {
    if (this.isConnected) return;

    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      await this.redis.psubscribe('health-check:*');
      this.isConnected = true;

      this.redis.on('pmessage', (_pattern: string, channel: string, message: string) => {
        try {
          const orgId = channel.replace('health-check:', '');
          const event = JSON.parse(message) as WsEvent;

          // Dispatch event only to the corresponding organization's WebSocket connections
          this.wsManager.broadcastToOrg(orgId, event);
        } catch (err: any) {
          console.error('[RedisSubscriber] Failed to parse and dispatch event:', err.message);
        }
      });

      this.redis.on('error', (err) => {
        console.error('[RedisSubscriber] Redis error:', err.message);
      });
    } catch (err: any) {
      console.error('[RedisSubscriber] Failed to start subscriber:', err.message);
    }
  }

  /**
   * Unsubscribe and close Redis connection.
   */
  public async stop(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.redis.punsubscribe('health-check:*');
      await this.redis.quit();
    } catch (err: any) {
      console.warn('[RedisSubscriber] Error while disconnecting:', err.message);
    } finally {
      this.isConnected = false;
    }
  }

  public getRedisClient(): Redis {
    return this.redis;
  }
}
