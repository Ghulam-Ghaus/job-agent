import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePreferenceDto } from './dto/create-preference.dto.js';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upsert — preferences are a single record per user. */
  upsert(userId: string, dto: CreatePreferenceDto) {
    return this.prisma.jobPreference.upsert({
      where: { userId },
      create: {
        userId,
        targetRoles: dto.targetRoles ?? [],
        targetCountries: dto.targetCountries ?? [],
        minSalaryUsd: dto.minSalaryUsd,
        remoteOk: dto.remoteOk ?? true,
        blacklistCompanies: dto.blacklistCompanies ?? [],
        blacklistKeywords: dto.blacklistKeywords ?? [],
        preferredIndustries: dto.preferredIndustries ?? [],
        atsTargets: (dto.atsTargets ?? []).map((t) => ({ platform: t.platform, slug: t.slug })),
        locationFilters: dto.locationFilters ?? [],
        cvStyle: dto.cvStyle ?? 'AUTO',
      },
      update: {
        ...(dto.targetRoles !== undefined && { targetRoles: dto.targetRoles }),
        ...(dto.targetCountries !== undefined && { targetCountries: dto.targetCountries }),
        ...(dto.minSalaryUsd !== undefined && { minSalaryUsd: dto.minSalaryUsd }),
        ...(dto.remoteOk !== undefined && { remoteOk: dto.remoteOk }),
        ...(dto.blacklistCompanies !== undefined && { blacklistCompanies: dto.blacklistCompanies }),
        ...(dto.blacklistKeywords !== undefined && { blacklistKeywords: dto.blacklistKeywords }),
        ...(dto.preferredIndustries !== undefined && { preferredIndustries: dto.preferredIndustries }),
        ...(dto.atsTargets !== undefined && {
          atsTargets: dto.atsTargets.map((t) => ({ platform: t.platform, slug: t.slug })),
        }),
        ...(dto.locationFilters !== undefined && { locationFilters: dto.locationFilters }),
        ...(dto.cvStyle !== undefined && { cvStyle: dto.cvStyle }),
      },
    });
  }

  findOne(userId: string) {
    return this.prisma.jobPreference.findUnique({ where: { userId } });
  }
}
