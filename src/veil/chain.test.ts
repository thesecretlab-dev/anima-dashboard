import { afterEach, describe, expect, it, vi } from "vitest";
import { VeilChain } from "./chain.js";

describe("VeilChain", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries transient fetch failures for read RPC calls", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { height: 123 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const chain = new VeilChain({ rpcUrl: "http://127.0.0.1:9999/rpc" });
    await expect(chain.getHeight()).resolves.toBe(123);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses deterministic idempotency keys for submitAction payloads", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ result: { success: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const chain = new VeilChain({ rpcUrl: "http://127.0.0.1:9999/rpc" });
    const payload = { marketId: "market-1", outcome: 0, amount: "10" };

    await chain.submitAction(2, payload, "0xabc");
    await chain.submitAction(2, payload, "0xabc");

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      params: [{ idempotencyKey: string }];
    };
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      params: [{ idempotencyKey: string }];
    };

    expect(firstBody.params[0].idempotencyKey).toBe(secondBody.params[0].idempotencyKey);
    expect(firstBody.params[0].idempotencyKey).toHaveLength(64);
  });
});
