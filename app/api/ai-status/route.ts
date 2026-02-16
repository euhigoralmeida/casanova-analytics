import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    AI_ENABLED: process.env.AI_ENABLED ?? "(not set, defaults to true)",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.slice(0, 10)}...)` : "NOT SET",
    AI_CHAT_MODEL: process.env.AI_CHAT_MODEL ?? "(not set, defaults to sonnet)",
    NODE_ENV: process.env.NODE_ENV,
  });
}
