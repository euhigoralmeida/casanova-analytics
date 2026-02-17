import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    AI_ENABLED: process.env.AI_ENABLED ?? "(not set, defaults to true)",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `set (${process.env.GEMINI_API_KEY.slice(0, 10)}...)` : "NOT SET",
    AI_CHAT_MODEL: process.env.AI_CHAT_MODEL ?? "(not set, default: gemini-2.0-flash)",
    NODE_ENV: process.env.NODE_ENV,
  });
}
