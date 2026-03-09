/**
 * Magazord typed queries — fetches orders and customers with caching.
 * Types will be adjusted when testing against the real API.
 */

import {
  getMagazordCredentials,
  magazordFetch,
  getMagazordCached,
  setMagazordCache,
  type MagazordCredentials,
} from "@/lib/magazord";

// ---------- Types ----------

export type MagazordOrderItem = {
  sku: string;
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type MagazordOrder = {
  id: number;
  codigo: string;
  dataHora: string;
  pessoaCpfCnpj: string;
  pessoaNome: string;
  formaPagamentoNome: string;
  formaRecebimentoNome: string;
  pedidoSituacaoDescricao: string;
  pedidoSituacaoTipo: number;
  valorProduto: string;
  valorFrete: string;
  valorDesconto: string;
  valorTotal: string;
  lojaId: number;
  lojaDoMarketplaceId: number | null;
  lojaDoMarketplaceNome: string | null;
  // Detail-only fields (not in list endpoint):
  estadoSigla?: string;
  origem?: number;
  cupomCodigo?: string;
  pedidoTrackingSource?: string;
  itens?: MagazordOrderItem[];
};

export type MagazordCustomer = {
  id: number;
  nome: string;
  cpfCnpj: string;
  email: string;
  dataCadastro: string;
};

// ---------- Queries ----------

export async function fetchOrders(
  startDate: string,
  endDate: string,
  tenantId?: string,
): Promise<MagazordOrder[]> {
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:magazord_orders_${startDate}_${endDate}`;
  const cached = getMagazordCached<MagazordOrder[]>(cacheKey);
  if (cached) return cached;

  const creds = await getMagazordCredentials(tenantId);
  if (!creds) throw new Error("MAGAZORD_NOT_CONFIGURED");

  const orders = await magazordFetch<MagazordOrder>(
    "/v2/site/pedido",
    { "dataHora[gte]": startDate, "dataHora[lte]": endDate },
    creds,
  );

  setMagazordCache(cacheKey, orders);
  return orders;
}

// ---------- Types (future endpoints) ----------

export type MagazordProduct = {
  id: number;
  sku: string;
  nome: string;
  preco: number;
  precoCusto: number;
  categoria: string;
  ativo: boolean;
};

export type MagazordCart = {
  id: number;
  dataHora: string;
  cpfCnpj: string;
  email: string;
  valorTotal: number;
  itens: { sku: string; nome: string; quantidade: number; valorUnitario: number }[];
};

export type MagazordCoupon = {
  id: number;
  codigo: string;
  desconto: number;
  tipo: "percentual" | "fixo";
  usos: number;
  ativo: boolean;
};

// ---------- Queries ----------

export async function fetchProducts(
  tenantId?: string,
): Promise<MagazordProduct[]> {
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:magazord_products`;
  const cached = getMagazordCached<MagazordProduct[]>(cacheKey);
  if (cached) return cached;

  const creds = await getMagazordCredentials(tenantId);
  if (!creds) throw new Error("MAGAZORD_NOT_CONFIGURED");

  const products = await magazordFetch<MagazordProduct>(
    "/v2/site/produto",
    { ativo: "true" },
    creds,
  );

  setMagazordCache(cacheKey, products);
  return products;
}

export async function fetchCarts(
  startDate: string,
  endDate: string,
  tenantId?: string,
): Promise<MagazordCart[]> {
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:magazord_carts_${startDate}_${endDate}`;
  const cached = getMagazordCached<MagazordCart[]>(cacheKey);
  if (cached) return cached;

  const creds = await getMagazordCredentials(tenantId);
  if (!creds) throw new Error("MAGAZORD_NOT_CONFIGURED");

  const carts = await magazordFetch<MagazordCart>(
    "/v2/site/carrinho",
    { "dataHora[gte]": startDate, "dataHora[lte]": endDate },
    creds,
  );

  setMagazordCache(cacheKey, carts);
  return carts;
}

export async function fetchCoupons(
  tenantId?: string,
): Promise<MagazordCoupon[]> {
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:magazord_coupons`;
  const cached = getMagazordCached<MagazordCoupon[]>(cacheKey);
  if (cached) return cached;

  const creds = await getMagazordCredentials(tenantId);
  if (!creds) throw new Error("MAGAZORD_NOT_CONFIGURED");

  const coupons = await magazordFetch<MagazordCoupon>(
    "/v2/site/cupomDesconto",
    {},
    creds,
  );

  setMagazordCache(cacheKey, coupons);
  return coupons;
}

// ---------- Lojas ----------

export type MagazordLoja = {
  id: number;
  nome: string;
  ativo: boolean;
  url: string;
};

export async function fetchLojas(
  tenantId?: string,
): Promise<MagazordLoja[]> {
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:magazord_lojas`;
  const cached = getMagazordCached<MagazordLoja[]>(cacheKey);
  if (cached) return cached;

  const creds = await getMagazordCredentials(tenantId);
  if (!creds) throw new Error("MAGAZORD_NOT_CONFIGURED");

  const lojas = await magazordFetch<MagazordLoja>(
    "/v2/site/loja",
    {},
    creds,
  );

  setMagazordCache(cacheKey, lojas);
  return lojas;
}

export async function fetchCustomers(
  startDate: string,
  endDate: string,
  tenantId?: string,
): Promise<MagazordCustomer[]> {
  const tid = tenantId ?? "default";
  const cacheKey = `${tid}:magazord_customers_${startDate}_${endDate}`;
  const cached = getMagazordCached<MagazordCustomer[]>(cacheKey);
  if (cached) return cached;

  const creds = await getMagazordCredentials(tenantId);
  if (!creds) throw new Error("MAGAZORD_NOT_CONFIGURED");

  const customers = await magazordFetch<MagazordCustomer>(
    "/v2/site/pessoa",
    { "dataCadastro[gte]": startDate, "dataCadastro[lte]": endDate },
    creds as MagazordCredentials,
  );

  setMagazordCache(cacheKey, customers);
  return customers;
}
