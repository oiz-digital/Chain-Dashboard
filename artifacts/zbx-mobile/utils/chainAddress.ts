import nacl from "tweetnacl";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAIN_KEY_STORAGE = "zbx_chain_wallet_v1";

export interface ChainWallet {
  publicKey: string;
  secretKey: string;
  address: string;
}

function toBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}
function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
function toHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}
function fromUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}
function toUtf8(arr: Uint8Array): string {
  return new TextDecoder().decode(arr);
}

function deriveAddress(publicKeyBytes: Uint8Array): string {
  const hash = nacl.hash(publicKeyBytes);
  return "zbx1" + toHex(hash.slice(0, 20));
}

export async function getOrCreateChainWallet(): Promise<ChainWallet> {
  const stored = await AsyncStorage.getItem(CHAIN_KEY_STORAGE);
  if (stored) return JSON.parse(stored) as ChainWallet;

  const kp = nacl.box.keyPair();
  const address = deriveAddress(kp.publicKey);
  const wallet: ChainWallet = {
    publicKey: toBase64(kp.publicKey),
    secretKey: toBase64(kp.secretKey),
    address,
  };
  await AsyncStorage.setItem(CHAIN_KEY_STORAGE, JSON.stringify(wallet));
  return wallet;
}

export async function getStoredChainWallet(): Promise<ChainWallet | null> {
  const stored = await AsyncStorage.getItem(CHAIN_KEY_STORAGE);
  return stored ? (JSON.parse(stored) as ChainWallet) : null;
}

export function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderSecretKeyB64: string
): { encrypted: string; nonce: string } {
  const message      = new Uint8Array(Buffer.from(plaintext, "utf8"));
  const nonce        = nacl.randomBytes(nacl.box.nonceLength);
  const recipientKey = fromBase64(recipientPublicKeyB64);
  const senderSecret = fromBase64(senderSecretKeyB64);
  const encrypted    = nacl.box(message, nonce, recipientKey, senderSecret);
  return { encrypted: toBase64(encrypted), nonce: toBase64(nonce) };
}

export function decryptMessage(
  encryptedB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  recipientSecretKeyB64: string
): string | null {
  try {
    const encrypted    = fromBase64(encryptedB64);
    const nonce        = fromBase64(nonceB64);
    const senderKey    = fromBase64(senderPublicKeyB64);
    const recipientKey = fromBase64(recipientSecretKeyB64);
    const decrypted    = nacl.box.open(encrypted, nonce, senderKey, recipientKey);
    if (!decrypted) return null;
    return Buffer.from(decrypted).toString("utf8");
  } catch {
    return null;
  }
}

export function shortenAddress(addr: string, front = 8, back = 6): string {
  if (addr.length <= front + back + 3) return addr;
  return addr.slice(0, front) + "..." + addr.slice(-back);
}

export function formatTxHash(hash: string, front = 8, back = 6): string {
  if (!hash) return "";
  if (hash.length <= front + back + 3) return hash;
  return hash.slice(0, front) + "..." + hash.slice(-back);
}

export function currentBlockHeight(): number {
  const GENESIS_MS   = 1700000000000;
  const BLOCK_TIME_MS = 2000;
  return Math.floor((Date.now() - GENESIS_MS) / BLOCK_TIME_MS);
}
