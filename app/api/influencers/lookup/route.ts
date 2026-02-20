import { NextRequest, NextResponse } from "next/server";
import { isInstagramConfigured, fetchIGBusinessDiscovery } from "@/lib/instagram";
import { buildLookupResponse } from "@/lib/influencer-discovery";

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("handle")?.trim();

  if (!handle) {
    return NextResponse.json({ error: "Parâmetro 'handle' é obrigatório" }, { status: 400 });
  }

  if (!isInstagramConfigured()) {
    return NextResponse.json(
      { error: "Instagram não configurado. Configure META_ADS_ACCESS_TOKEN nas variáveis de ambiente." },
      { status: 503 },
    );
  }

  try {
    const discovery = await fetchIGBusinessDiscovery(handle);
    const response = buildLookupResponse(discovery);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    const status = message.includes("não encontrada") || message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
