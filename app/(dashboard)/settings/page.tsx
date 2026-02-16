"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Plus, Trash2, Package, RefreshCw } from "lucide-react";

type SkuRow = {
  sku: string;
  nome: string;
  marginPct: number;
  stock: number;
  costOfGoods: number | null;
  category: string | null;
  isNew?: boolean;
};

export default function SettingsPage() {
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSkus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/sku-master");
      if (res.ok) {
        const data = await res.json();
        setSkus(data.skus);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateSku(index: number, field: keyof SkuRow, value: string | number | null) {
    setSkus((prev) => {
      const copy = [...prev];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (copy[index] as any)[field] = value;
      return copy;
    });
    setDirty(true);
  }

  function addSku() {
    setSkus((prev) => [...prev, { sku: "", nome: "", marginPct: 30, stock: 0, costOfGoods: null, category: null, isNew: true }]);
    setDirty(true);
  }

  function removeSku(index: number) {
    const sku = skus[index];
    if (sku.isNew) {
      setSkus((prev) => prev.filter((_, i) => i !== index));
    } else {
      if (!confirm(`Remover SKU "${sku.sku}"?`)) return;
      fetch(`/api/settings/sku-master?sku=${encodeURIComponent(sku.sku)}`, { method: "DELETE" })
        .then(() => {
          setSkus((prev) => prev.filter((_, i) => i !== index));
          setMessage({ type: "success", text: `SKU "${sku.sku}" removido` });
        })
        .catch(() => setMessage({ type: "error", text: "Erro ao remover" }));
    }
  }

  async function saveAll() {
    const valid = skus.filter((s) => s.sku.trim() && s.nome.trim());
    if (valid.length === 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/sku-master", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skus: valid.map((s) => ({
            sku: s.sku.trim(),
            nome: s.nome.trim(),
            marginPct: s.marginPct,
            stock: s.stock,
            costOfGoods: s.costOfGoods,
            category: s.category,
          })),
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `${valid.length} SKU(s) salvos com sucesso` });
        setDirty(false);
        loadSkus(); // Reload to get clean data
      } else {
        setMessage({ type: "error", text: "Erro ao salvar" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Configurações</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gerencie dados de SKUs, margem e estoque</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSkus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recarregar
          </button>
          <button
            onClick={saveAll}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-xl border p-3 text-sm font-medium ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      {/* SKU Master Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-zinc-50 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-800">Cadastro de SKUs</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-600 font-medium">
              {skus.length} SKU{skus.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={addSku}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar SKU
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-400">Carregando...</div>
        ) : skus.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-500 mb-3">Nenhum SKU cadastrado</p>
            <p className="text-xs text-zinc-400 mb-4">
              Cadastre seus SKUs com margem e estoque para que o Motor Cognitivo calcule impacto financeiro real.
            </p>
            <button onClick={addSku} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-700">
              <Plus className="h-4 w-4" />
              Cadastrar primeiro SKU
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-500">
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-3 py-3 font-medium">Nome</th>
                  <th className="px-3 py-3 font-medium text-right">Margem %</th>
                  <th className="px-3 py-3 font-medium text-right">Estoque</th>
                  <th className="px-3 py-3 font-medium text-right">Custo Unit.</th>
                  <th className="px-3 py-3 font-medium">Categoria</th>
                  <th className="px-3 py-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {skus.map((sku, i) => (
                  <tr key={sku.sku || `new-${i}`} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50">
                    <td className="px-5 py-2">
                      <input
                        type="text"
                        value={sku.sku}
                        onChange={(e) => updateSku(i, "sku", e.target.value)}
                        disabled={!sku.isNew}
                        className="w-full max-w-[140px] text-xs font-mono bg-transparent border-0 p-0 focus:ring-0 disabled:text-zinc-500"
                        placeholder="27290BR-CP"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={sku.nome}
                        onChange={(e) => updateSku(i, "nome", e.target.value)}
                        className="w-full max-w-[200px] text-xs bg-transparent border-0 p-0 focus:ring-0"
                        placeholder="Nome do produto"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={sku.marginPct}
                        onChange={(e) => updateSku(i, "marginPct", parseFloat(e.target.value) || 0)}
                        className="w-16 text-xs text-right bg-transparent border-0 p-0 focus:ring-0"
                        min={0}
                        max={100}
                        step={1}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={sku.stock}
                        onChange={(e) => updateSku(i, "stock", parseInt(e.target.value) || 0)}
                        className="w-16 text-xs text-right bg-transparent border-0 p-0 focus:ring-0"
                        min={0}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={sku.costOfGoods ?? ""}
                        onChange={(e) => updateSku(i, "costOfGoods", e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-20 text-xs text-right bg-transparent border-0 p-0 focus:ring-0"
                        placeholder="—"
                        min={0}
                        step={0.01}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={sku.category ?? ""}
                        onChange={(e) => updateSku(i, "category", e.target.value || null)}
                        className="w-full max-w-[120px] text-xs bg-transparent border-0 p-0 focus:ring-0"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeSku(i)}
                        className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Como funciona</h3>
        <ul className="text-xs text-blue-800 space-y-1.5">
          <li>Os dados de margem e estoque são usados pelo Motor Cognitivo para calcular impacto financeiro real.</li>
          <li>SKUs sem cadastro usam margem padrão de 30% e estoque 0.</li>
          <li>O campo &quot;Custo Unitário&quot; é opcional — usado para cálculos de lucro bruto quando disponível.</li>
          <li>O status de cada SKU (Escalar/Manter/Pausar) é calculado automaticamente com base em ROAS, CPA, margem e estoque.</li>
        </ul>
      </div>
    </div>
  );
}
