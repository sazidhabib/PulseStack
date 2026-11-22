import { TenantScope } from '@pulsestack/db';
import { NotFoundError } from '@pulsestack/shared';

export class IncidentService {
  async listIncidents(
    scope: TenantScope,
    options: { page?: number; limit?: number; status?: 'open' | 'resolved' } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const [incidents, total] = await Promise.all([
      scope.incidents.findAll({ limit, offset, status: options.status }),
      scope.incidents.count({ status: options.status }),
    ]);

    return {
      items: incidents,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getIncidentById(scope: TenantScope, id: string) {
    const incident = await scope.incidents.findById(id);
    if (!incident) {
      throw new NotFoundError(`Incident with ID ${id} not found`);
    }
    return incident;
  }
}
