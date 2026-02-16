"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import ChatMessage from "./chat-message";
import AskSuggestions from "./ask-suggestions";
import { usePathname } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
};

interface AskAnalyticsProps {
  dateRange: { startDate: string; endDate: string };
}

const SUGGESTIONS_BY_PATH: Record<string, string[]> = {
  "/overview": [
    "Como está minha performance?",
    "Vou bater a meta de receita?",
    "Quais ações rápidas para melhorar?",
    "Resumo executivo da semana",
  ],
  "/acquisition/google": [
    "Qual campanha tem melhor ROAS?",
    "Compare desktop vs mobile",
    "Quais SKUs devo pausar?",
    "Performance por tipo de campanha",
  ],
  "/acquisition/segments": [
    "Performance por faixa etária",
    "Qual dispositivo tem melhor retorno?",
    "Quais regiões investir mais?",
    "Compare mobile vs desktop",
  ],
  "/funnel": [
    "Qual a taxa de abandono?",
    "Onde estou perdendo clientes?",
    "Como melhorar conversão?",
    "Compare canais de aquisição",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "Como está meu ROAS?",
  "Por que a receita caiu?",
  "Vou bater a meta?",
  "Quais ações rápidas?",
];

export default function AskAnalytics({ dateRange }: AskAnalyticsProps) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = SUGGESTIONS_BY_PATH[pathname] ?? DEFAULT_SUGGESTIONS;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);
    setIsOpen(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          context: { startDate: dateRange.startDate, endDate: dateRange.endDate },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao processar pergunta");
        return;
      }

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.response }]);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, [messages, loading, dateRange]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleSuggestionClick(suggestion: string) {
    sendMessage(suggestion);
  }

  function handleNewConversation() {
    setMessages([]);
    setError(null);
    setIsOpen(false);
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="mb-4">
      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-2.5 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
          <Sparkles size={16} className="text-violet-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte qualquer coisa sobre seus dados..."
            className="flex-1 text-sm text-zinc-700 placeholder:text-zinc-400 bg-transparent outline-none"
            disabled={loading}
          />
          {loading ? (
            <Loader2 size={16} className="text-violet-500 animate-spin shrink-0" />
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="text-violet-500 hover:text-violet-700 disabled:text-zinc-300 transition-colors shrink-0"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions (only when no active conversation) */}
      {!isOpen && messages.length === 0 && (
        <AskSuggestions suggestions={suggestions} onSelect={handleSuggestionClick} />
      )}

      {/* Response Area */}
      {isOpen && (
        <div className="mt-3 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 bg-zinc-50">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-violet-500" />
              <span className="text-xs font-medium text-violet-700">Análise IA</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewConversation}
                className="text-xs text-zinc-500 hover:text-violet-600 transition-colors"
              >
                Nova pergunta
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-violet-500">
                <Loader2 size={14} className="animate-spin" />
                <span>Analisando seus dados...</span>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
