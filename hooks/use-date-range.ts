"use client";

import { useState, useCallback } from "react";
import type { DateRange } from "@/types/api";
import { defaultRange } from "@/lib/constants";

export function useDateRange() {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);

  const buildParams = useCallback((range: DateRange, extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("period", range.preset ?? "custom");
    params.set("startDate", range.startDate);
    params.set("endDate", range.endDate);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        params.set(k, v);
      }
    }
    return params.toString();
  }, []);

  return { dateRange, setDateRange, buildParams };
}
