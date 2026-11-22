import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncidentService } from '../../src/services/incident.service';
import { NotFoundError } from '@pulsestack/shared';

describe('IncidentService', () => {
  let incidentService: IncidentService;
  let mockScope: any;

  beforeEach(() => {
    incidentService = new IncidentService();
    mockScope = {
      incidents: {
        findAll: vi.fn(),
        count: vi.fn(),
        findById: vi.fn(),
      },
    };
  });

  it('should list incidents with pagination and status filter', async () => {
    const fakeIncidents = [
      { id: 'inc-1', type: 'down', cause: 'HTTP 503', startedAt: new Date() },
    ];
    mockScope.incidents.findAll.mockResolvedValue(fakeIncidents);
    mockScope.incidents.count.mockResolvedValue(1);

    const result = await incidentService.listIncidents(mockScope, {
      page: 1,
      limit: 10,
      status: 'open',
    });

    expect(result.items).toEqual(fakeIncidents);
    expect(result.meta.total).toBe(1);
    expect(mockScope.incidents.findAll).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      status: 'open',
    });
  });

  it('should return incident detail by ID', async () => {
    const fakeIncident = { id: 'inc-1', type: 'down' };
    mockScope.incidents.findById.mockResolvedValue(fakeIncident);

    const result = await incidentService.getIncidentById(mockScope, 'inc-1');
    expect(result).toEqual(fakeIncident);
  });

  it('should throw NotFoundError if incident does not exist', async () => {
    mockScope.incidents.findById.mockResolvedValue(null);

    await expect(incidentService.getIncidentById(mockScope, 'missing-inc')).rejects.toThrow(
      NotFoundError
    );
  });
});
