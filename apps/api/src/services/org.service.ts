import { TenantScope } from '@pulsestack/db';
import { NotFoundError, UpdateOrgInput } from '@pulsestack/shared';

export class OrgService {
  async getOrg(scope: TenantScope) {
    const org = await scope.organization.get();
    if (!org) {
      throw new NotFoundError('Organization not found');
    }
    return org;
  }

  async updateOrg(scope: TenantScope, data: UpdateOrgInput) {
    const updated = await scope.organization.update(data);
    if (!updated) {
      throw new NotFoundError('Organization not found');
    }
    return updated;
  }
}
