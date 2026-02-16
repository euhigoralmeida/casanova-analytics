import crypto from "crypto";

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-in-production-32ch";
const COOKIE_NAME = "ca_session";
const MAX_AGE = 86400; // 24h

export type SessionPayload = {
  tenantId: string;
  email: string;
  role: string;
  exp: number;
};

function sign(payload: SessionPayload): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64url");
  const hmac = crypto.createHmac("sha256", AUTH_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${hmac}`;
}

function verify(token: string): SessionPayload | null {
  const [encoded, hmac] = token.split(".");
  if (!encoded || !hmac) return null;

  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(encoded).digest("base64url");
  if (hmac !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(tenantId: string, email: string, role: string): string {
  return sign({ tenantId, email, role, exp: Date.now() + MAX_AGE * 1000 });
}

export function verifySessionToken(token: string): SessionPayload | null {
  return verify(token);
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = MAX_AGE;

/** Extract tenantId from request cookie. Returns "default" as fallback. */
export function extractTenantId(req: { cookies: { get: (name: string) => { value: string } | undefined } }): string {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return "default";
  const session = verify(cookie.value);
  return session?.tenantId ?? "default";
}

/** Get full session from request, or null if not authenticated */
export function getSession(req: { cookies: { get: (name: string) => { value: string } | undefined } }): SessionPayload | null {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return null;
  return verify(cookie.value);
}
