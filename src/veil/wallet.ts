/**
 * VEIL Wallet Management
 *
 * Local EVM wallet for ANIMA agents on the VEIL L1 chain.
 * Inspired by Conway Terminal's wallet pattern — auto-created on first run,
 * stored locally with restricted permissions.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { VEIL_CHAIN_CONFIG } from "./constants.js";
import { decrypt, encrypt, type EncryptedBlob } from "./security.js";

export const VEIL_WALLET_PASSPHRASE_ENV = "ANIMA_VEIL_WALLET_PASSPHRASE";

export interface WalletData {
  address: string;
  privateKey?: string;
  encryptedPrivateKey?: EncryptedBlob;
  createdAt: string;
  chainId: number;
}

export interface VeilWallet {
  address: string;
  privateKey: string;
  chainId: number;
}

function getWalletPath(): string {
  const configDir = path.join(os.homedir(), VEIL_CHAIN_CONFIG.configDir);
  return path.join(configDir, VEIL_CHAIN_CONFIG.walletFile);
}

function ensureConfigDir(): string {
  const configDir = path.join(os.homedir(), VEIL_CHAIN_CONFIG.configDir);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
  return configDir;
}

function resolvePassphrase(passphrase?: string): string {
  const resolved = (passphrase ?? process.env[VEIL_WALLET_PASSPHRASE_ENV] ?? "").trim();
  if (!resolved) {
    throw new Error(
      `Missing VEIL wallet passphrase. Set ${VEIL_WALLET_PASSPHRASE_ENV} or pass it directly.`,
    );
  }
  return resolved;
}

function privateKeyHexToBuffer(privateKey: string): Buffer {
  const normalized = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  return Buffer.from(normalized, "hex");
}

function deriveAddressFromPrivateKey(privateKey: string): string {
  const ecdh = crypto.createECDH("secp256k1");
  ecdh.setPrivateKey(privateKeyHexToBuffer(privateKey));
  const pubkeyUncompressed = ecdh.getPublicKey(undefined, "uncompressed");
  const pubkeyNoPrefix = pubkeyUncompressed.subarray(1);

  let digest: Buffer;
  try {
    digest = crypto.createHash("sha3-256").update(pubkeyNoPrefix).digest();
  } catch {
    // Fallback to sha256 if the platform hash list is restricted.
    digest = crypto.createHash("sha256").update(pubkeyNoPrefix).digest();
  }
  return `0x${digest.subarray(digest.length - 20).toString("hex")}`;
}

function generatePrivateKey(): string {
  while (true) {
    const seed = crypto.randomBytes(32);
    try {
      const ecdh = crypto.createECDH("secp256k1");
      ecdh.setPrivateKey(seed);
      return `0x${seed.toString("hex")}`;
    } catch {
      // retry until we get a valid secp256k1 private key
    }
  }
}

/**
 * Create a new wallet.
 * Stores at ~/.anima/wallet.json with restricted permissions.
 */
export async function createWallet(passphrase?: string): Promise<VeilWallet> {
  ensureConfigDir();
  const walletPath = getWalletPath();
  const walletPassphrase = resolvePassphrase(passphrase);

  if (fs.existsSync(walletPath)) {
    throw new Error(`Wallet already exists at ${walletPath}. Use loadWallet() instead.`);
  }

  const privateKey = generatePrivateKey();
  const address = deriveAddressFromPrivateKey(privateKey);

  const walletData: WalletData = {
    address,
    encryptedPrivateKey: encrypt(privateKey, walletPassphrase),
    createdAt: new Date().toISOString(),
    chainId: VEIL_CHAIN_CONFIG.chainId,
  };

  fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2), { mode: 0o600 });

  return {
    address,
    privateKey,
    chainId: VEIL_CHAIN_CONFIG.chainId,
  };
}

/**
 * Load existing wallet from ~/.anima/wallet.json
 */
export async function loadWallet(passphrase?: string): Promise<VeilWallet> {
  const walletPath = getWalletPath();

  if (!fs.existsSync(walletPath)) {
    throw new Error(`No wallet found at ${walletPath}. Use createWallet() first.`);
  }

  const raw = fs.readFileSync(walletPath, "utf-8");
  const data: WalletData = JSON.parse(raw);
  let privateKey = "";

  if (data.encryptedPrivateKey) {
    const walletPassphrase = resolvePassphrase(passphrase);
    try {
      privateKey = decrypt(data.encryptedPrivateKey, walletPassphrase);
    } catch {
      throw new Error("Failed to decrypt wallet private key. Verify wallet passphrase.");
    }
  } else if (data.privateKey) {
    // Migrate legacy plaintext wallet files to encrypted storage on first successful load.
    const walletPassphrase = resolvePassphrase(passphrase);
    privateKey = data.privateKey;
    const migrated: WalletData = {
      address: data.address,
      encryptedPrivateKey: encrypt(privateKey, walletPassphrase),
      createdAt: data.createdAt,
      chainId: data.chainId || VEIL_CHAIN_CONFIG.chainId,
    };
    fs.writeFileSync(walletPath, JSON.stringify(migrated, null, 2), { mode: 0o600 });
  } else {
    throw new Error(`Wallet file at ${walletPath} has no private key material.`);
  }

  const address = deriveAddressFromPrivateKey(privateKey);

  return {
    address: data.address || address,
    privateKey,
    chainId: data.chainId || VEIL_CHAIN_CONFIG.chainId,
  };
}

/**
 * Get wallet address without loading private key
 */
export function getWalletAddress(): string | null {
  const walletPath = getWalletPath();
  if (!fs.existsSync(walletPath)) return null;

  const raw = fs.readFileSync(walletPath, "utf-8");
  const data: WalletData = JSON.parse(raw);
  return data.address;
}

/**
 * Check if a wallet exists
 */
export function walletExists(): boolean {
  return fs.existsSync(getWalletPath());
}
