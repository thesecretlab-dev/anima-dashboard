/**
 * VEIL Markets — Prediction Market Operations
 *
 * Market creation, trading, position management, P/L tracking.
 * All orders go through the encrypted commit-reveal pipeline.
 */

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { VeilChain, type ActionResult } from "./chain.js";
import { VEIL_ACTIONS } from "./constants.js";

export interface MarketInfo {
  id: string;
  question: string;
  outcomes: string[];
  status: "active" | "resolved" | "disputed" | "paused";
  clearingPrice?: number;
  volume?: string;
  createdAt: string;
  resolvesAt?: string;
}

export interface Position {
  marketId: string;
  outcome: number;
  shares: string;
  avgPrice: string;
  unrealizedPnl?: string;
}

export interface OrderParams {
  marketId: string;
  outcome: number;
  side: "buy" | "sell";
  amount: string;
  limitPrice?: string;
}

const COMMITTEE_KEY_ENV = "ANIMA_VEIL_COMMITTEE_KEY";

export class VeilMarkets {
  private chain: VeilChain;

  constructor(chain: VeilChain) {
    this.chain = chain;
  }

  /** Create a new prediction market */
  async createMarket(
    question: string,
    outcomes: string[],
    resolvesAt: string,
    privateKey: string,
  ): Promise<ActionResult> {
    return this.chain.submitAction(VEIL_ACTIONS.CreateMarket, {
      question,
      outcomes,
      resolvesAt,
    }, privateKey);
  }

  /**
   * Place an order via encrypted commit-reveal.
   * The order is encrypted to the epoch committee key before submission.
   * Decryption happens at batch close via threshold reveals.
   */
  async placeOrder(params: OrderParams, privateKey: string): Promise<ActionResult> {
    const orderPayload = JSON.stringify({
      marketId: params.marketId,
      outcome: params.outcome,
      side: params.side,
      amount: params.amount,
      limitPrice: params.limitPrice,
    });

    const encryptedPayload = this.encryptOrderPayload(orderPayload);
    const commitmentHash = await this.hashCommitment(encryptedPayload);

    return this.chain.commitOrder(
      params.marketId,
      encryptedPayload,
      commitmentHash,
      privateKey,
    );
  }

  /** Get market info by ID */
  async getMarket(marketId: string): Promise<MarketInfo> {
    const result = await this.chain.getMarket(marketId);
    return result as MarketInfo;
  }

  /** Get all positions for an address */
  async getPositions(address: string): Promise<Position[]> {
    const result = await this.chain.rpc("veilvm.getPositions", [address]);
    return result as Position[];
  }

  /** Get P/L summary for an address */
  async getPnL(address: string): Promise<{ totalPnl: string; positions: Position[] }> {
    const positions = await this.getPositions(address);
    // TODO: calculate real P/L from position data + current market prices
    return {
      totalPnl: "0",
      positions,
    };
  }

  /** Dispute a market resolution */
  async disputeMarket(marketId: string, evidence: string, privateKey: string): Promise<ActionResult> {
    return this.chain.submitAction(VEIL_ACTIONS.Dispute, {
      marketId,
      evidence,
    }, privateKey);
  }

  /** Hash a commitment for the commit-reveal scheme */
  private async hashCommitment(payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private encryptOrderPayload(orderPayload: string): string {
    const committeeKey = String(process.env[COMMITTEE_KEY_ENV] || "").trim();
    if (!committeeKey) {
      throw new Error(
        `Missing encrypted-commit key. Set ${COMMITTEE_KEY_ENV} before submitting market orders.`,
      );
    }

    const key = createHash("sha256").update(committeeKey).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(orderPayload, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Envelope format is deterministic for parser compatibility:
    // v1:<iv base64url>:<tag base64url>:<ciphertext base64url>
    return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
  }
}
