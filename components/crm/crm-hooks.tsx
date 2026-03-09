"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import { useLastUpdated } from "@/hooks/use-last-updated";
import type { DateRange } from "@/types/api";
import type { CRMAnalytics } from "@/lib/crm-engine";

export type Filial = { key: string; label: string; orders: number };

export type CRMResponse = CRMAnalytics & {
  source: "magazord" | "not_configured";
  updatedAt: string;
  filiais: Filial[];
};

const BLOCKED_TENANTS = ["yellalife"];

export function crmDefaultRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 364);
  return { startDate: fmtDate(start), endDate: fmtDate(end), label: "Últimos 365 dias", preset: "365d" };
}

export function useBlockedTenant(): boolean {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("ca_tenant");
      if (raw) {
        const t = JSON.parse(raw);
        if (t.id && BLOCKED_TENANTS.includes(t.id)) setBlocked(true);
      }
    } catch { /* ignore */ }
  }, []);
  return blocked;
}

export function useCRMData() {
  const blocked = useBlockedTenant();
  const [data, setData] = useState<CRMResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { label: updatedLabel, markUpdated } = useLastUpdated();

  const [dateRange, setDateRange] = useState<DateRange>(crmDefaultRange);
  const [availableFiliais, setAvailableFiliais] = useState<Filial[]>([]);
  const [selectedFiliais, setSelectedFiliais] = useState<string[]>([]);

  const loadData = useCallback(async (range: DateRange, filiais: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("startDate", range.startDate);
      params.set("endDate", range.endDate);
      if (filiais.length > 0) params.set("filiais", filiais.join(","));

      const res = await fetch(`/api/crm?${params}`);
      if (!res.ok) throw new Error("Erro ao carregar dados CRM");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      if (json.filiais) setAvailableFiliais(json.filiais);
      markUpdated();
    } catch {
      setError("Erro ao carregar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [markUpdated]);

  useEffect(() => {
    loadData(dateRange, selectedFiliais);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDateChange(range: DateRange) {
    setDateRange(range);
    loadData(range, selectedFiliais);
  }

  function handleFiliaisChange(newFiliais: string[]) {
    setSelectedFiliais(newFiliais);
    loadData(dateRange, newFiliais);
  }

  function refresh() {
    loadData(dateRange, selectedFiliais);
  }

  return {
    blocked,
    data,
    loading,
    error,
    updatedLabel,
    dateRange,
    availableFiliais,
    selectedFiliais,
    handleDateChange,
    handleFiliaisChange,
    refresh,
  };
}
