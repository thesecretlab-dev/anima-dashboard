import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

async function pauseForWrites(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

describe("appendRawStream", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not write raw stream logs in production without explicit allow flag", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "anima-raw-stream-"));
    const rawPath = path.join(tmp, "raw.jsonl");
    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ANIMA_RAW_STREAM", "1");
      vi.stubEnv("ANIMA_ALLOW_RAW_STREAM", "0");
      vi.stubEnv("ANIMA_RAW_STREAM_PATH", rawPath);

      vi.resetModules();
      const { appendRawStream } = await import("./pi-embedded-subscribe.raw-stream.js");
      appendRawStream({ token: "sk-abcdef1234567890ghij" });
      await pauseForWrites();

      await expect(fs.stat(rawPath)).rejects.toThrow();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("writes redacted payloads when explicitly enabled in production", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "anima-raw-stream-"));
    const rawPath = path.join(tmp, "raw.jsonl");
    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ANIMA_RAW_STREAM", "1");
      vi.stubEnv("ANIMA_ALLOW_RAW_STREAM", "1");
      vi.stubEnv("ANIMA_RAW_STREAM_PATH", rawPath);

      vi.resetModules();
      const { appendRawStream } = await import("./pi-embedded-subscribe.raw-stream.js");
      appendRawStream({
        token: "sk-abcdef1234567890ghij",
        header: "Authorization: Bearer abcdef1234567890ghij",
      });
      await pauseForWrites();

      const lines = (await fs.readFile(rawPath, "utf8")).trim().split("\n");
      expect(lines.length).toBe(1);
      const line = lines[0] ?? "";
      expect(line).not.toContain("sk-abcdef1234567890ghij");
      expect(line).not.toContain("abcdef1234567890ghij");
      expect(line).toContain("abcdef");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
