import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';

describe('PublicController', () => {
  let controller: PublicController;
  let serviceMock: any;

  beforeEach(() => {
    serviceMock = {
      getPublicProfile: vi.fn().mockResolvedValue({ name: 'Ghulam Ghaus', slug: 'ghulam-ghaus' }),
      getPublicProducts: vi.fn().mockResolvedValue([]),
      submitInquiry: vi.fn().mockResolvedValue({ success: true }),
    };

    controller = new PublicController(serviceMock as unknown as PublicService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return default profile', async () => {
    const res = await controller.getDefaultProfile();
    expect(res.name).toBe('Ghulam Ghaus');
    expect(serviceMock.getPublicProfile).toHaveBeenCalledWith();
  });

  it('should return profile by slug', async () => {
    const res = await controller.getProfileBySlug('ghulam-ghaus');
    expect(res.slug).toBe('ghulam-ghaus');
    expect(serviceMock.getPublicProfile).toHaveBeenCalledWith('ghulam-ghaus');
  });

  it('should return products', async () => {
    const res = await controller.getProducts();
    expect(res).toEqual([]);
    expect(serviceMock.getPublicProducts).toHaveBeenCalled();
  });
});
