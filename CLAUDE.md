# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Casanova Analytics MVP — a dashboard for e-commerce SKU-level analytics (ROAS, CPA, margin, stock, funnel). The UI is in Brazilian Portuguese. It fetches metrics from two local API endpoints with mock data.

## Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config with Next.js core-web-vitals + TypeScript rules)

## Tech Stack

- **Next.js 16** with App Router (all files under `app/`)
- **React 19** with client components (`"use client"`)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** via `@tailwindcss/postcss` plugin
- **Path alias:** `@/*` maps to project root

## Architecture

Single-page app. `app/page.tsx` is the main entry point — a client component that:
- Holds all state (period, SKU, API responses for metrics + overview)
- Fetches from both `/api/metrics` and `/api/overview` in parallel
- Renders: progress bars vs monthly goals, SKU ranking table, 12 KPI cards (3 rows), severity alerts, and a per-SKU funnel table

### API Endpoints

**`/api/metrics?period={7d|14d|30d|60d}&sku={sku}`** (`app/api/metrics/route.ts`)
- Returns detailed metrics for a single SKU: 12 KPI cards, dynamic alerts with severity, 5-step funnel
- 3 SKU profiles: `27290BR-CP` (champion), `31450BR-LX` (at risk), `19820BR-ST` (median)
- Alerts are threshold-based: ROAS < 5 (danger), CPA > R$80 (danger), margin < 25% (warn), stock risk

**`/api/overview?period={7d|14d|30d|60d}`** (`app/api/overview/route.ts`)
- Returns consolidated view of all SKUs: revenue/ROAS/margin targets, SKU ranking with auto-status (escalar/manter/pausar), Mercado Livre price comparison

### Components (in `app/page.tsx`)

- `Kpi` — KPI card with optional health status border (green/yellow/red)
- `ProgressBar` — Horizontal progress bar with conditional color
- `StatusBadge` — Colored badge for SKU action (Escalar/Manter/Pausar)

### Key Types

- `ApiResponse` — Single-SKU data: `cards` (12 numeric KPIs), `alerts` (with severity), `funnel`
- `OverviewResponse` — All-SKU data: `meta` (targets vs actual), `skus[]` (with status + ML comparison)

## Notes

- No test framework is configured yet.
- ESLint uses the flat config format (`eslint.config.mjs`).
- All data is mock. SKU profiles are hardcoded in the route handlers.
- Owner thresholds: ROAS pause < 5, target ≥ 7; CPA pause > R$80; margin target ≥ 25%.
