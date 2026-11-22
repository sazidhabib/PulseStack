import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  DbClient,
  monitors,
  healthCheckResults,
  incidents,
  webhooks,
  eq,
  and,
  isNull,
} from '@pulsestack/db';
import {
  HealthCheckJobData,
  WebhookDispatchJobData,
  WsEvent,
} from '@pulsestack/shared';
import { httpPing } from '../utils/http-ping';

export function createHealthCheckProcessor(
  db: DbClient,
  redisPublisher: IORedis,
  webhookQueue: Queue<WebhookDispatchJobData>
) {
  return async (job: Job<HealthCheckJobData>) => {
    const { monitorId, orgId, url, method, timeout, expectedStatus, headers } = job.data;

    // 1. Measure HTTP endpoint
    const pingResult = await httpPing(url, {
      method,
      timeout,
      expectedStatus,
      headers,
    });

    const now = new Date();

    // 2. Persist health check measurement
    await db.insert(healthCheckResults).values({
      monitorId,
      orgId,
      statusCode: pingResult.statusCode,
      latencyMs: pingResult.latencyMs,
      status: pingResult.status,
      errorMessage: pingResult.error,
      checkedAt: now,
    });

    // 3. Check monitor state
    const monitorRows = await db
      .select()
      .from(monitors)
      .where(and(eq(monitors.id, monitorId), eq(monitors.orgId, orgId)));

    const monitor = monitorRows[0];
    if (!monitor) {
      return { status: 'skipped', reason: 'monitor deleted' };
    }

    const previousStatus = monitor.status;
    const currentStatus = pingResult.status;

    // 4. Status change detection & Incident lifecycle
    if (previousStatus !== currentStatus) {
      await db
        .update(monitors)
        .set({
          status: currentStatus,
          lastCheckedAt: now,
          updatedAt: now,
        })
        .where(eq(monitors.id, monitorId));

      if (currentStatus === 'down' || currentStatus === 'degraded') {
        // Create incident
        const [newIncident] = await db
          .insert(incidents)
          .values({
            monitorId,
            orgId,
            type: currentStatus,
            cause: pingResult.error || `HTTP ${pingResult.statusCode}`,
            startedAt: now,
          })
          .returning();

        const incidentEvent: WsEvent = {
          type: 'incident:created',
          data: {
            incidentId: newIncident?.id ?? `inc-${now.getTime()}`,
            monitorId,
            orgId,
            type: currentStatus,
            startedAt: now.toISOString(),
          },
        };
        await redisPublisher.publish(`health-check:${orgId}`, JSON.stringify(incidentEvent));
      } else if (
        currentStatus === 'up' &&
        (previousStatus === 'down' || previousStatus === 'degraded')
      ) {
        // Resolve incident
        const resolvedIncidents = await db
          .update(incidents)
          .set({ resolvedAt: now })
          .where(and(eq(incidents.monitorId, monitorId), isNull(incidents.resolvedAt)))
          .returning();

        for (const inc of resolvedIncidents) {
          const resolvedEvent: WsEvent = {
            type: 'incident:resolved',
            data: {
              incidentId: inc.id,
              monitorId,
              orgId,
              resolvedAt: now.toISOString(),
            },
          };
          await redisPublisher.publish(`health-check:${orgId}`, JSON.stringify(resolvedEvent));
        }
      }

      // Enqueue webhooks
      const orgWebhooks = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.orgId, orgId), eq(webhooks.isActive, true)));

      const targetEvent = `monitor.${currentStatus}`;

      for (const hook of orgWebhooks) {
        if (hook.events.includes(targetEvent) || hook.events.includes('*')) {
          await webhookQueue.add('dispatch', {
            webhookId: hook.id,
            orgId,
            url: hook.url,
            secret: hook.secret,
            event: targetEvent,
            payload: {
              event: targetEvent,
              monitor: {
                id: monitor.id,
                name: monitor.name,
                url: monitor.url,
              },
              previousStatus,
              currentStatus,
              latencyMs: pingResult.latencyMs,
              statusCode: pingResult.statusCode,
              timestamp: now.toISOString(),
            },
          });
        }
      }

      // Publish status change event to Redis Pub/Sub
      const statusChangeEvent: WsEvent = {
        type: 'monitor:status-changed',
        data: {
          monitorId,
          orgId,
          from: previousStatus,
          to: currentStatus,
          changedAt: now.toISOString(),
        },
      };

      await redisPublisher.publish(`health-check:${orgId}`, JSON.stringify(statusChangeEvent));
    } else {
      // Just update lastCheckedAt
      await db
        .update(monitors)
        .set({ lastCheckedAt: now })
        .where(eq(monitors.id, monitorId));
    }

    // 5. Publish real-time telemetry to Redis Pub/Sub
    const telemetryEvent: WsEvent = {
      type: 'health-check:result',
      data: {
        monitorId,
        orgId,
        status: currentStatus,
        latencyMs: pingResult.latencyMs,
        statusCode: pingResult.statusCode,
        checkedAt: now.toISOString(),
      },
    };

    await redisPublisher.publish(`health-check:${orgId}`, JSON.stringify(telemetryEvent));

    return {
      monitorId,
      status: currentStatus,
      latencyMs: pingResult.latencyMs,
    };
  };
}
