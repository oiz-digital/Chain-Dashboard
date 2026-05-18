import nacl from "tweetnacl";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_STORAGE = "zbx_chat_keypair_v1";

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

function toBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString("base64");
}
function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}
function toUtf8(arr: Uint8Array): string {
  return Buffer.from(arr).toString("utf8");
}
function fromUtf8(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "utf8"));
}

export async function getOrCreateKeyPair(): Promise<KeyPair> {
  const stored = await AsyncStorage.getItem(KEY_STORAGE);
  if (stored) return JSON.parse(stored) as KeyPair;
  const kp = nacl.box.keyPair();
  const pair: KeyPair = {
    publicKey: toBase64(kp.publicKey),
    secretKey: toBase64(kp.secretKey),
  };
  await AsyncStorage.setItem(KEY_STORAGE, JSON.stringify(pair));
  return pair;
}

export async function getStoredKeyPair(): Promise<KeyPair | null> {
  const stored = await AsyncStorage.getItem(KEY_STORAGE);
  return stored ? (JSON.parse(stored) as KeyPair) : null;
}

export function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderSecretKeyB64: string
): { encrypted: string; nonce: string } {
  const message       = fromUtf8(plaintext);
  const nonce         = nacl.randomBytes(nacl.box.nonceLength);
  const recipientKey  = fromBase64(recipientPublicKeyB64);
  const senderSecret  = fromBase64(senderSecretKeyB64);
  const encrypted     = nacl.box(message, nonce, recipientKey, senderSecret);
  return {
    encrypted: toBase64(encrypted),
    nonce:     toBase64(nonce),
  };
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
    return toUtf8(decrypted);
  } catch {
    return null;
  }
}
