import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getEffectiveTenantId } from "@/lib/api-helpers";
import { fetchIGBusinessDiscovery } from "@/lib/instagram";
import { buildLookupResponse } from "@/lib/influencer-discovery";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return auth.error;
  const tenantId = getEffectiveTenantId(auth.session);

  const handle = req.nextUrl.searchParams.get("handle")?.trim();

  if (!handle) {
    return NextResponse.json({ error: "Parâmetro 'handle' é obrigatório" }, { status: 400 });
  }

  try {
    const discovery = await fetchIGBusinessDiscovery(handle, tenantId);
    const response = buildLookupResponse(discovery);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    const status = message.includes("não encontrada") || message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
