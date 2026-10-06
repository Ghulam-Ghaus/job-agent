-- AlterEnum
ALTER TYPE "OpportunityStatus" ADD VALUE 'FILTERED_OUT';

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "filterFlags" JSONB DEFAULT '[]',
ADD COLUMN     "filterReason" TEXT,
ADD COLUMN     "outreachFollowUpDue" TIMESTAMP(3),
ADD COLUMN     "outreachPack" JSONB,
ADD COLUMN     "outreachSentAt" TIMESTAMP(3),
ADD COLUMN     "outreachStatus" TEXT DEFAULT 'not_sent',
ADD COLUMN     "scoreAdjustments" JSONB DEFAULT '[]';
