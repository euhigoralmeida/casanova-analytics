"use client";

import { useState, useCallback } from "react";

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (url: string): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const json = await res.json();
      setData(json);
      return json;
    } catch {
      setError("Não foi possível carregar os dados.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, setData, loading, error, fetchData };
}
