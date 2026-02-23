import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VEIL_CHAIN_CONFIG } from "./constants.js";
import { createWallet, loadWallet } from "./wallet.js";

const WALLET_PASSPHRASE_ENV = "ANIMA_VEIL_WALLET_PASSPHRASE";

function getWalletPath(homeDir: string): string {
  return path.join(homeDir, VEIL_CHAIN_CONFIG.configDir, VEIL_CHAIN_CONFIG.walletFile);
}

describe("veil wallet encryption", () => {
  let tempHome = "";

  beforeEach(async () => {
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "anima-veil-wallet-"));
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("USERPROFILE", tempHome);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (tempHome) {
      await fs.rm(tempHome, { recursive: true, force: true });
    }
  });

  it("fails closed when passphrase is missing", async () => {
    vi.stubEnv(WALLET_PASSPHRASE_ENV, "");
    await expect(createWallet()).rejects.toThrow(WALLET_PASSPHRASE_ENV);
  });

  it("persists encrypted key material and can load with passphrase", async () => {
    vi.stubEnv(WALLET_PASSPHRASE_ENV, "unit-test-passphrase");
    const created = await createWallet();

    const walletPath = getWalletPath(tempHome);
    const raw = JSON.parse(await fs.readFile(walletPath, "utf8")) as {
      privateKey?: string;
      encryptedPrivateKey?: unknown;
    };

    expect(raw.privateKey).toBeUndefined();
    expect(raw.encryptedPrivateKey).toBeTruthy();

    const loaded = await loadWallet();
    expect(loaded.privateKey).toBe(created.privateKey);
    expect(loaded.address).toBe(created.address);
  });

  it("migrates legacy plaintext wallet files to encrypted storage", async () => {
    vi.stubEnv(WALLET_PASSPHRASE_ENV, "migration-passphrase");
    const created = await createWallet();
    const walletPath = getWalletPath(tempHome);
    await fs.writeFile(
      walletPath,
      JSON.stringify(
        {
          address: created.address,
          privateKey: created.privateKey,
          createdAt: new Date().toISOString(),
          chainId: VEIL_CHAIN_CONFIG.chainId,
        },
        null,
        2,
      ),
      "utf8",
    );

    const loaded = await loadWallet();
    expect(loaded.privateKey).toBe(created.privateKey);

    const migrated = JSON.parse(await fs.readFile(walletPath, "utf8")) as {
      privateKey?: string;
      encryptedPrivateKey?: unknown;
    };
    expect(migrated.privateKey).toBeUndefined();
    expect(migrated.encryptedPrivateKey).toBeTruthy();
  });
});
