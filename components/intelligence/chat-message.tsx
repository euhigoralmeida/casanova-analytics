"use client";

import DOMPurify from "isomorphic-dompurify";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-zinc-100 rounded-xl px-4 py-2.5 text-sm text-zinc-800">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-zinc-700 leading-relaxed prose prose-sm max-w-none prose-strong:text-violet-800"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMarkdown(content)) }}
      />
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^(\d+)\.\s/gm, "<br/>$1. ")
    .replace(/^•\s/gm, "<br/>• ")
    .replace(/^- /gm, "<br/>• ")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
