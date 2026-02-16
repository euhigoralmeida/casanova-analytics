"use client";

import { useState, useEffect } from "react";
import { Sparkles, RefreshCw } from "lucide-react";

interface AiInsightsProps {
  startDate: string;
  endDate: string;
}

export default function AiInsights({ startDate, endDate }: AiInsightsProps) {
  const [analysis, setAnalysis] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchInsights() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });

      if (res.status === 503) {
        setError("disabled");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao gerar insights");
        return;
      }

      const data = await res.json();
      setAnalysis(data.analysis ?? "");
      setHighlights(data.highlights ?? []);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (startDate && endDate) {
      fetchInsights();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Don't render if AI is disabled
  if (error === "disabled") return null;

  return (
    <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-600" />
          <h3 className="text-sm font-semibold text-violet-800">Análise IA</h3>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="text-violet-500 hover:text-violet-700 transition-colors disabled:opacity-50"
          title="Atualizar análise"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && !analysis && (
        <div className="space-y-2">
          <div className="h-4 bg-violet-100 rounded animate-pulse w-full" />
          <div className="h-4 bg-violet-100 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-violet-100 rounded animate-pulse w-4/6" />
        </div>
      )}

      {error && error !== "disabled" && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {analysis && (
        <div className="space-y-3">
          <div
            className="text-sm text-zinc-700 leading-relaxed prose prose-sm max-w-none prose-strong:text-violet-800"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(analysis) }}
          />
          {highlights.length > 0 && (
            <ul className="space-y-1.5 mt-3 pt-3 border-t border-violet-200">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                  <span className="text-violet-500 mt-0.5">•</span>
                  <span dangerouslySetInnerHTML={{ __html: formatMarkdown(h) }} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Simple markdown formatter — bold + line breaks only */
function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}
