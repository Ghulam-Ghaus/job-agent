import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { Role } from '../generated/prisma/enums.js';

describe('AdminController', () => {
  let controller: AdminController;
  let serviceMock: any;

  beforeEach(() => {
    serviceMock = {
      getUsers: vi.fn().mockResolvedValue([]),
      updateUser: vi.fn().mockResolvedValue({ id: 'u-1', role: Role.USER }),
      getLlmMetrics: vi.fn().mockResolvedValue({ summary: {} }),
      getAuditLogs: vi.fn().mockResolvedValue([]),
      getSourcesStatus: vi.fn().mockResolvedValue({ sources: [] }),
    };

    controller = new AdminController(serviceMock as unknown as AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get users', async () => {
    const res = await controller.getUsers();
    expect(res).toEqual([]);
    expect(serviceMock.getUsers).toHaveBeenCalled();
  });

  it('should update user role', async () => {
    const res = await controller.updateUser('u-1', { role: Role.USER });
    expect(res.role).toBe(Role.USER);
    expect(serviceMock.updateUser).toHaveBeenCalledWith('u-1', { role: Role.USER });
  });

  it('should get llm metrics', async () => {
    const res = await controller.getLlmMetrics();
    expect(res).toBeDefined();
    expect(serviceMock.getLlmMetrics).toHaveBeenCalled();
  });
});
