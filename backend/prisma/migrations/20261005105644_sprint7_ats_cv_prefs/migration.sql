-- AlterTable
ALTER TABLE "job_preferences" ADD COLUMN     "atsTargets" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "cvStyle" TEXT NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "locationFilters" JSONB NOT NULL DEFAULT '[]';
