-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'pattern',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "insightId" TEXT,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Insight_tenantId_periodStart_idx" ON "Insight"("tenantId", "periodStart");

-- CreateIndex
CREATE INDEX "Insight_tenantId_createdAt_idx" ON "Insight"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionLog_tenantId_createdAt_idx" ON "ActionLog"("tenantId", "createdAt");
