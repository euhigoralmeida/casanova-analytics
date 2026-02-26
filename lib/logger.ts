import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

type LogContext = {
  tenantId?: string;
  route?: string;
  [key: string]: unknown;
};

function emit(level: LogLevel, message: string, ctx?: LogContext, error?: unknown) {
  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (ctx) {
    if (ctx.tenantId) entry.tenantId = ctx.tenantId;
    if (ctx.route) entry.route = ctx.route;
    // Spread remaining context fields
    for (const [k, v] of Object.entries(ctx)) {
      if (k !== "tenantId" && k !== "route") entry[k] = v;
    }
  }

  if (error) {
    if (error instanceof Error) {
      entry.error = { name: error.name, message: error.message, stack: error.stack };
    } else {
      entry.error = String(error);
    }
  }

  const json = JSON.stringify(entry);

  if (level === "error") {
    console.error(json);
  } else if (level === "warn") {
    console.warn(json);
  } else {
    console.log(json);
  }
}

export const logger = {
  info(message: string, ctx?: LogContext) {
    emit("info", message, ctx);
  },
  warn(message: string, ctx?: LogContext) {
    emit("warn", message, ctx);
  },
  error(message: string, ctx?: LogContext, error?: unknown) {
    emit("error", message, ctx, error);
    // Forward to Sentry for error tracking
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { message, ...ctx } });
    } else if (error) {
      Sentry.captureMessage(message, { level: "error", extra: { ...ctx, rawError: String(error) } });
    } else {
      Sentry.captureMessage(message, { level: "error", extra: ctx });
    }
  },
};
