-- AlterTable
ALTER TABLE "PlanningEntry" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "PlanningSyncLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "year" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanningSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningSyncLog_tenantId_year_idx" ON "PlanningSyncLog"("tenantId", "year");
