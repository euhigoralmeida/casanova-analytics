import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // DB unreachable
  }

  const latencyMs = Date.now() - start;
  const status = dbOk ? "healthy" : "degraded";

  return NextResponse.json(
    {
      status,
      checks: {
        database: { ok: dbOk, latencyMs },
      },
    },
    { status: dbOk ? 200 : 503 },
  );
}
