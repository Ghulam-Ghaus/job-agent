-- CreateTable
CREATE TABLE "tailored_cvs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "targetRole" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "verifierStatus" TEXT NOT NULL DEFAULT 'pending',
    "verifierIssues" JSONB NOT NULL DEFAULT '[]',
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tailored_cvs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_letters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyEdited" TEXT,
    "verifierStatus" TEXT NOT NULL DEFAULT 'pending',
    "verifierIssues" JSONB NOT NULL DEFAULT '[]',
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cover_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_preps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "targetRole" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "tasksJson" JSONB NOT NULL DEFAULT '[]',
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_preps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tailored_cvs_userId_idx" ON "tailored_cvs"("userId");

-- CreateIndex
CREATE INDEX "tailored_cvs_userId_opportunityId_idx" ON "tailored_cvs"("userId", "opportunityId");

-- CreateIndex
CREATE INDEX "tailored_cvs_inputHash_idx" ON "tailored_cvs"("inputHash");

-- CreateIndex
CREATE INDEX "cover_letters_userId_idx" ON "cover_letters"("userId");

-- CreateIndex
CREATE INDEX "cover_letters_userId_opportunityId_idx" ON "cover_letters"("userId", "opportunityId");

-- CreateIndex
CREATE INDEX "cover_letters_inputHash_idx" ON "cover_letters"("inputHash");

-- CreateIndex
CREATE INDEX "interview_preps_userId_idx" ON "interview_preps"("userId");

-- CreateIndex
CREATE INDEX "interview_preps_userId_opportunityId_idx" ON "interview_preps"("userId", "opportunityId");

-- CreateIndex
CREATE INDEX "interview_preps_inputHash_idx" ON "interview_preps"("inputHash");

-- AddForeignKey
ALTER TABLE "tailored_cvs" ADD CONSTRAINT "tailored_cvs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tailored_cvs" ADD CONSTRAINT "tailored_cvs_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_preps" ADD CONSTRAINT "interview_preps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_preps" ADD CONSTRAINT "interview_preps_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
