-- CreateTable
CREATE TABLE "apply_packs" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coverNote" TEXT NOT NULL,
    "coverNoteEdited" TEXT,
    "selectedCvId" TEXT,
    "answersFilled" JSONB NOT NULL DEFAULT '[]',
    "verifierStatus" TEXT NOT NULL DEFAULT 'pending',
    "verifierIssues" JSONB NOT NULL DEFAULT '[]',
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apply_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" TEXT NOT NULL,
    "applyPackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apply_packs_opportunityId_key" ON "apply_packs"("opportunityId");

-- CreateIndex
CREATE INDEX "apply_packs_userId_idx" ON "apply_packs"("userId");

-- CreateIndex
CREATE INDEX "apply_packs_verifierStatus_idx" ON "apply_packs"("verifierStatus");

-- CreateIndex
CREATE UNIQUE INDEX "approval_records_applyPackId_key" ON "approval_records"("applyPackId");

-- CreateIndex
CREATE INDEX "approval_records_userId_idx" ON "approval_records"("userId");

-- AddForeignKey
ALTER TABLE "apply_packs" ADD CONSTRAINT "apply_packs_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apply_packs" ADD CONSTRAINT "apply_packs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_applyPackId_fkey" FOREIGN KEY ("applyPackId") REFERENCES "apply_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
