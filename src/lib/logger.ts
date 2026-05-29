/**
 * Logger ringan — JSON line, mudah di-pipe ke Loki/Datadog.
 * JANGAN log payload kredensial.
 */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta ?? {}),
  };
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
