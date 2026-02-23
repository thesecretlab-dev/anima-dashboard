import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { redactSensitiveText } from "../logging/redact.js";

function isRawStreamEnabled(): boolean {
  if (!isTruthyEnvValue(process.env.ANIMA_RAW_STREAM)) {
    return false;
  }
  const isDevelopment = String(process.env.NODE_ENV || "").trim() === "development";
  if (isDevelopment) {
    return true;
  }
  return isTruthyEnvValue(process.env.ANIMA_ALLOW_RAW_STREAM);
}

function resolveRawStreamPath(): string {
  return (
    process.env.ANIMA_RAW_STREAM_PATH?.trim() ||
    path.join(resolveStateDir(), "logs", "raw-stream.jsonl")
  );
}

function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  try {
    const serialized = JSON.stringify(payload);
    const redacted = redactSensitiveText(serialized, { mode: "tools" });
    const parsed = JSON.parse(redacted);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { redacted };
  } catch {
    return { redaction_error: true };
  }
}

let rawStreamReadyPath = "";

export function appendRawStream(payload: Record<string, unknown>) {
  if (!isRawStreamEnabled()) {
    return;
  }
  const rawStreamPath = resolveRawStreamPath();
  if (rawStreamReadyPath !== rawStreamPath) {
    rawStreamReadyPath = rawStreamPath;
    try {
      fs.mkdirSync(path.dirname(rawStreamPath), { recursive: true, mode: 0o700 });
    } catch {
      // ignore raw stream mkdir failures
    }
  }
  try {
    const safePayload = redactPayload(payload);
    void fs.promises.appendFile(rawStreamPath, `${JSON.stringify(safePayload)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // ignore raw stream write failures
  }
}
