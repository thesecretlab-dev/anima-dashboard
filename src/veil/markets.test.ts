import { afterEach, describe, expect, it, vi } from "vitest";
import { VeilMarkets } from "./markets.js";

describe("VeilMarkets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when committee encryption key is not configured", async () => {
    vi.stubEnv("ANIMA_VEIL_COMMITTEE_KEY", "");
    const commitOrder = vi.fn();
    const markets = new VeilMarkets({ commitOrder } as unknown as ConstructorParameters<
      typeof VeilMarkets
    >[0]);

    await expect(
      markets.placeOrder(
        {
          marketId: "btc-100k",
          outcome: 1,
          side: "buy",
          amount: "50",
        },
        "0xprivate",
      ),
    ).rejects.toThrow("ANIMA_VEIL_COMMITTEE_KEY");

    expect(commitOrder).not.toHaveBeenCalled();
  });

  it("submits encrypted commit payloads and deterministic commitment hashes", async () => {
    vi.stubEnv("ANIMA_VEIL_COMMITTEE_KEY", "committee-key-material");
    const commitOrder = vi.fn().mockResolvedValue({ success: true });
    const markets = new VeilMarkets({ commitOrder } as unknown as ConstructorParameters<
      typeof VeilMarkets
    >[0]);

    await markets.placeOrder(
      {
        marketId: "btc-100k",
        outcome: 1,
        side: "buy",
        amount: "50",
        limitPrice: "0.44",
      },
      "0xprivate",
    );

    expect(commitOrder).toHaveBeenCalledTimes(1);
    const args = commitOrder.mock.calls[0] as [string, string, string, string];
    const encryptedPayload = args[1];
    const commitmentHash = args[2];

    expect(encryptedPayload.startsWith("v1:")).toBe(true);
    expect(encryptedPayload.includes("\"marketId\"")).toBe(false);
    expect(commitmentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
