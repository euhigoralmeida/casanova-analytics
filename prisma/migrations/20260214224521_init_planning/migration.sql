-- CreateTable
CREATE TABLE "PlanningEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanningEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanningEntry_tenantId_year_idx" ON "PlanningEntry"("tenantId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningEntry_tenantId_year_month_metric_key" ON "PlanningEntry"("tenantId", "year", "month", "metric");
