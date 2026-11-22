import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MonitorService } from '../../src/services/monitor.service';
import { NotFoundError } from '@pulsestack/shared';

describe('MonitorService', () => {
  let monitorService: MonitorService;
  let mockScope: any;

  beforeEach(() => {
    monitorService = new MonitorService();
    mockScope = {
      monitors: {
        findAll: vi.fn(),
        count: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      healthChecks: {
        findByMonitor: vi.fn(),
        countByMonitor: vi.fn(),
        getStats: vi.fn(),
      },
    };
  });

  describe('listMonitors', () => {
    it('should return paginated monitors and metadata', async () => {
      const fakeMonitors = [{ id: 'm-1', name: 'API Server' }];
      mockScope.monitors.findAll.mockResolvedValue(fakeMonitors);
      mockScope.monitors.count.mockResolvedValue(1);

      const result = await monitorService.listMonitors(mockScope, { page: 1, limit: 10 });

      expect(result.items).toEqual(fakeMonitors);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(mockScope.monitors.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        status: undefined,
        search: undefined,
      });
    });
  });

  describe('getMonitorById', () => {
    it('should return monitor when found', async () => {
      const fakeMonitor = { id: 'm-1', name: 'API Server' };
      mockScope.monitors.findById.mockResolvedValue(fakeMonitor);

      const result = await monitorService.getMonitorById(mockScope, 'm-1');
      expect(result).toEqual(fakeMonitor);
    });

    it('should throw NotFoundError when monitor is not found', async () => {
      mockScope.monitors.findById.mockResolvedValue(null);

      await expect(monitorService.getMonitorById(mockScope, 'missing-id')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createMonitor', () => {
    it('should create monitor with valid fields', async () => {
      const input = {
        name: 'Database Health',
        url: 'https://db.internal/health',
        method: 'GET' as const,
        intervalSeconds: 60,
        timeout: 10000,
        expectedStatus: 200,
        headers: {},
        isActive: true,
      };

      mockScope.monitors.create.mockResolvedValue({ id: 'm-new', ...input });

      const result = await monitorService.createMonitor(mockScope, input);
      expect(result.id).toBe('m-new');
      expect(mockScope.monitors.create).toHaveBeenCalledWith(input);
    });
  });

  describe('pause & resume', () => {
    it('should pause an active monitor', async () => {
      mockScope.monitors.findById.mockResolvedValue({ id: 'm-1', isActive: true });
      mockScope.monitors.update.mockResolvedValue({ id: 'm-1', isActive: false });

      const result = await monitorService.pauseMonitor(mockScope, 'm-1');
      expect(result.isActive).toBe(false);
      expect(mockScope.monitors.update).toHaveBeenCalledWith('m-1', { isActive: false });
    });

    it('should resume a paused monitor', async () => {
      mockScope.monitors.findById.mockResolvedValue({ id: 'm-1', isActive: false });
      mockScope.monitors.update.mockResolvedValue({ id: 'm-1', isActive: true });

      const result = await monitorService.resumeMonitor(mockScope, 'm-1');
      expect(result.isActive).toBe(true);
      expect(mockScope.monitors.update).toHaveBeenCalledWith('m-1', { isActive: true });
    });
  });

  describe('getMonitorStats', () => {
    it('should return calculated telemetry percentiles and uptime', async () => {
      mockScope.monitors.findById.mockResolvedValue({
        id: 'm-1',
        name: 'Web app',
        status: 'up',
        lastCheckedAt: new Date(),
      });

      const fakeStats = {
        totalChecks: 100,
        uptimePercentage: 99.5,
        avgLatencyMs: 42,
        p95LatencyMs: 85,
        p99LatencyMs: 140,
      };

      mockScope.healthChecks.getStats.mockResolvedValue(fakeStats);

      const result = await monitorService.getMonitorStats(mockScope, 'm-1');
      expect(result.stats.uptimePercentage).toBe(99.5);
      expect(result.stats.avgLatencyMs).toBe(42);
      expect(result.stats.p95LatencyMs).toBe(85);
      expect(result.stats.p99LatencyMs).toBe(140);
    });
  });
});
