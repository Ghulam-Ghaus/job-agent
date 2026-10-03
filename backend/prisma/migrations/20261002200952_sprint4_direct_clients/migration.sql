-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('RESEARCHING', 'QUALIFIED', 'DRAFT_READY', 'CONTACTED', 'REPLIED', 'MEETING', 'PROPOSAL_SENT', 'WON', 'LOST', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT', 'REJECTED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placeId" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "businessType" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'RESEARCHING',
    "qualificationScore" INTEGER,
    "needSignalsJson" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_messages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "approvalId" TEXT,
    "optOutToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppression_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT,
    "email" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppression_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_userId_idx" ON "companies"("userId");

-- CreateIndex
CREATE INDEX "companies_userId_status_idx" ON "companies"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "companies_userId_placeId_key" ON "companies"("userId", "placeId");

-- CreateIndex
CREATE INDEX "contacts_companyId_idx" ON "contacts"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_messages_optOutToken_key" ON "outreach_messages"("optOutToken");

-- CreateIndex
CREATE INDEX "outreach_messages_userId_idx" ON "outreach_messages"("userId");

-- CreateIndex
CREATE INDEX "outreach_messages_companyId_idx" ON "outreach_messages"("companyId");

-- CreateIndex
CREATE INDEX "outreach_messages_status_idx" ON "outreach_messages"("status");

-- CreateIndex
CREATE INDEX "suppression_entries_userId_idx" ON "suppression_entries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "suppression_entries_userId_domain_key" ON "suppression_entries"("userId", "domain");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppression_entries" ADD CONSTRAINT "suppression_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
