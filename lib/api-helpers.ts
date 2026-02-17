import { NextRequest, NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";

type AuthSuccess = { session: SessionPayload };
type AuthFailure = { error: NextResponse };

/**
 * Validate session cookie on API routes. Returns session on success, or a 401 response on failure.
 */
export function requireAuth(req: NextRequest): AuthSuccess | AuthFailure {
  const session = getSession(req);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}
