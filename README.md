# Casanova Analytics

Dashboard de analytics para e-commerce com dados do Google Ads, GA4 e insights por IA. Interface em portugues brasileiro.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Google Ads API** (`google-ads-api` / Opteo)
- **GA4** (`@google-analytics/data`)
- **Google Gemini** (insights e chat por IA)
- **Prisma** (planejamento anual)
- **Vercel** (deploy)

## Setup

```bash
# 1. Clonar e instalar
git clone https://github.com/euhigoralmeida/casanova-analytics.git
cd casanova-analytics
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Preencher os valores no .env.local

# 3. Rodar em dev
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Login

| Campo | Valor |
|-------|-------|
| Email | `admin@casanova.com` |
| Senha | `casanova2024` |

## Scripts

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao |
| `npm run lint` | ESLint |

## Estrutura

```
app/
  (dashboard)/
    overview/         # Visao Geral — KPIs, alertas, insights IA
    planning/         # Planejamento anual (metas vs realizado)
    acquisition/
      google/         # Google Ads — SKUs, campanhas, charts
      meta/           # Meta Ads (em breve)
      segments/       # Segmentacao (device, demografico, geografico)
    funnel/           # Funil e-commerce (GA4)
    alerts/           # Alertas inteligentes
    retention/        # Retencao (em breve)
    settings/         # SKU master data
  api/                # Endpoints REST
components/
  ui/                 # Componentes compartilhados
  charts/             # Graficos (Recharts)
  intelligence/       # Chat IA e insights
  planning/           # Tabelas de planejamento
lib/                  # Google Ads, GA4, auth, alertas, IA
```

## Variaveis de Ambiente

Veja `.env.example` para a lista completa. As principais:

- `AUTH_SECRET` — Obrigatorio. Secret HMAC para cookies de sessao.
- `GOOGLE_ADS_*` — Credenciais Google Ads (6 vars).
- `GA4_*` — Credenciais GA4 service account.
- `DATABASE_URL` — Postgres (Prisma).
- `GEMINI_API_KEY` — Google Gemini para insights IA.

## Deploy (Vercel)

1. Importar o repositorio no Vercel
2. Configurar todas as env vars (ver `.env.example`)
3. Para GA4: usar `GA4_PRIVATE_KEY_BASE64` (base64 da chave privada) em vez de `GA4_PRIVATE_KEY`
4. Deploy automatico no push para `main`
