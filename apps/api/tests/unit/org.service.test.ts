import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrgService } from '../../src/services/org.service';
import { NotFoundError } from '@pulsestack/shared';

describe('OrgService', () => {
  let orgService: OrgService;
  let mockScope: any;

  beforeEach(() => {
    orgService = new OrgService();
    mockScope = {
      organization: {
        get: vi.fn(),
        update: vi.fn(),
      },
    };
  });

  it('should return organization profile', async () => {
    const fakeOrg = { id: 'org-1', name: 'Pulse Corp', slug: 'pulse-corp' };
    mockScope.organization.get.mockResolvedValue(fakeOrg);

    const result = await orgService.getOrg(mockScope);
    expect(result).toEqual(fakeOrg);
  });

  it('should update organization name', async () => {
    const updatedOrg = { id: 'org-1', name: 'Pulse Corp v2', slug: 'pulse-corp' };
    mockScope.organization.update.mockResolvedValue(updatedOrg);

    const result = await orgService.updateOrg(mockScope, { name: 'Pulse Corp v2' });
    expect(result.name).toBe('Pulse Corp v2');
    expect(mockScope.organization.update).toHaveBeenCalledWith({ name: 'Pulse Corp v2' });
  });

  it('should throw NotFoundError if org is missing', async () => {
    mockScope.organization.get.mockResolvedValue(null);

    await expect(orgService.getOrg(mockScope)).rejects.toThrow(NotFoundError);
  });
});
