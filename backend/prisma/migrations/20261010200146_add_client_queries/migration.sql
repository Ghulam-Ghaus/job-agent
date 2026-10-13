-- CreateTable
CREATE TABLE "client_queries" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'TEXT',
    "query" TEXT NOT NULL,
    "response" TEXT,
    "action" TEXT,
    "toolName" TEXT,
    "latencyMs" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_queries_channel_idx" ON "client_queries"("channel");

-- CreateIndex
CREATE INDEX "client_queries_createdAt_idx" ON "client_queries"("createdAt");

-- CreateIndex
CREATE INDEX "client_queries_sessionId_idx" ON "client_queries"("sessionId");
