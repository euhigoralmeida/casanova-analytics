"use client";

interface AskSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export default function AskSuggestions({ suggestions, onSelect }: AskSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <span className="text-xs text-zinc-400 self-center">Experimente:</span>
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="text-xs px-3 py-1.5 rounded-full border border-zinc-200 text-zinc-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
