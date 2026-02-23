import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { createAnthropicPayloadLogger } from "./anthropic-payload-log.js";

async function pauseForWrites(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

describe("createAnthropicPayloadLogger", () => {
  afterEach(() => {
    delete process.env.ANIMA_ANTHROPIC_PAYLOAD_LOG;
    delete process.env.ANIMA_ALLOW_PAYLOAD_LOG;
    delete process.env.ANIMA_ANTHROPIC_PAYLOAD_LOG_FILE;
    delete process.env.NODE_ENV;
  });

  it("stays disabled in production without explicit override", () => {
    const logger = createAnthropicPayloadLogger({
      env: {
        ...process.env,
        NODE_ENV: "production",
        ANIMA_ANTHROPIC_PAYLOAD_LOG: "1",
        ANIMA_ALLOW_PAYLOAD_LOG: "0",
      },
    });
    expect(logger).toBeNull();
  });

  it("writes redacted request payloads when enabled", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "anima-anthropic-payload-"));
    const payloadPath = path.join(tmp, "payload.jsonl");
    try {
      const logger = createAnthropicPayloadLogger({
        env: {
          ...process.env,
          NODE_ENV: "development",
          ANIMA_ANTHROPIC_PAYLOAD_LOG: "1",
          ANIMA_ANTHROPIC_PAYLOAD_LOG_FILE: payloadPath,
        },
        runId: "run-1",
        sessionId: "session-1",
      });
      expect(logger).not.toBeNull();

      const streamFn: StreamFn = ((_model, _context, options) => {
        options?.onPayload?.({
          Authorization: "Bearer abcdef1234567890ghij",
          token: "sk-abcdef1234567890ghij",
        });
        return Promise.resolve(null) as unknown as ReturnType<StreamFn>;
      }) as StreamFn;

      const wrapped = logger!.wrapStreamFn(streamFn);
      await Promise.resolve(
        wrapped({ api: "anthropic-messages" } as unknown as Model<Api>, {} as never, {}),
      );
      await pauseForWrites();

      const lines = (await fs.readFile(payloadPath, "utf8")).trim().split("\n");
      expect(lines.length).toBe(1);

      const row = JSON.parse(lines[0] || "{}") as { payload: unknown };
      const payloadJson = JSON.stringify(row.payload);
      expect(payloadJson).not.toContain("abcdef1234567890ghij");
      expect(payloadJson).not.toContain("sk-abcdef1234567890ghij");
      expect(payloadJson).toContain("abcdef");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
