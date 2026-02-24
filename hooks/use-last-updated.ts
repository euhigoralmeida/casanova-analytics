"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tracks when data was last loaded and returns a relative time string.
 * Updates every 30s so the display stays fresh.
 */
export function useLastUpdated() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [label, setLabel] = useState<string>("");

  const markUpdated = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;

    function computeLabel() {
      if (!lastUpdated) return;
      const diffMs = Date.now() - lastUpdated.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) {
        setLabel("Atualizado agora");
      } else {
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) {
          setLabel(`Atualizado há ${diffMin} min`);
        } else {
          const diffH = Math.floor(diffMin / 60);
          setLabel(`Atualizado há ${diffH}h`);
        }
      }
    }

    computeLabel();
    const interval = setInterval(computeLabel, 30_000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return { label, markUpdated };
}
