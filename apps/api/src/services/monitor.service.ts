import { TenantScope } from '@pulsestack/db';
import {
  CreateMonitorInput,
  UpdateMonitorInput,
  MonitorQueryInput,
  NotFoundError,
} from '@pulsestack/shared';
import { QueueService } from './queue.service';

export class MonitorService {
  constructor(private queueService?: QueueService) {}

  async listMonitors(scope: TenantScope, query: MonitorQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const [monitors, total] = await Promise.all([
      scope.monitors.findAll({
        limit,
        offset,
        status: query.status,
        search: query.search,
      }),
      scope.monitors.count({
        status: query.status,
        search: query.search,
      }),
    ]);

    return {
      items: monitors,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getMonitorById(scope: TenantScope, id: string) {
    const monitor = await scope.monitors.findById(id);
    if (!monitor) {
      throw new NotFoundError(`Monitor with ID ${id} not found`);
    }
    return monitor;
  }

  async createMonitor(scope: TenantScope, data: CreateMonitorInput) {
    const created = await scope.monitors.create({
      name: data.name,
      url: data.url,
      method: data.method,
      intervalSeconds: data.intervalSeconds,
      timeout: data.timeout,
      expectedStatus: data.expectedStatus,
      headers: data.headers,
      isActive: data.isActive,
    });

    if (created.isActive && this.queueService) {
      await this.queueService.scheduleMonitor(created);
    }

    return created;
  }

  async updateMonitor(scope: TenantScope, id: string, data: UpdateMonitorInput) {
    await this.getMonitorById(scope, id);
    const updated = await scope.monitors.update(id, data);

    if (updated && this.queueService) {
      if (updated.isActive) {
        await this.queueService.scheduleMonitor(updated);
      } else {
        await this.queueService.removeMonitor(id);
      }
    }

    return updated!;
  }

  async deleteMonitor(scope: TenantScope, id: string) {
    await this.getMonitorById(scope, id);
    const deleted = await scope.monitors.delete(id);

    if (this.queueService) {
      await this.queueService.removeMonitor(id);
    }

    return deleted!;
  }

  async pauseMonitor(scope: TenantScope, id: string) {
    await this.getMonitorById(scope, id);
    const paused = await scope.monitors.update(id, { isActive: false });

    if (this.queueService) {
      await this.queueService.removeMonitor(id);
    }

    return paused!;
  }

  async resumeMonitor(scope: TenantScope, id: string) {
    await this.getMonitorById(scope, id);
    const resumed = await scope.monitors.update(id, { isActive: true });

    if (resumed && this.queueService) {
      await this.queueService.scheduleMonitor(resumed);
    }

    return resumed!;
  }

  async getMonitorResults(scope: TenantScope, id: string, page = 1, limit = 50) {
    await this.getMonitorById(scope, id);
    const offset = (page - 1) * limit;

    const [results, total] = await Promise.all([
      scope.healthChecks.findByMonitor(id, limit, offset),
      scope.healthChecks.countByMonitor(id),
    ]);

    return {
      items: results,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getMonitorStats(scope: TenantScope, id: string) {
    const monitor = await this.getMonitorById(scope, id);
    const stats = await scope.healthChecks.getStats(id);

    return {
      monitor: {
        id: monitor.id,
        name: monitor.name,
        status: monitor.status,
        lastCheckedAt: monitor.lastCheckedAt,
      },
      stats,
    };
  }
}
