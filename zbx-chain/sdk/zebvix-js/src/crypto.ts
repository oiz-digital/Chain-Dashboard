/**
 * ZbxCrypto — cryptographic utilities for ZBX chain.
 * Zero external dependencies — uses Web Crypto API.
 */
export const ZbxCrypto = {

  /**
   * Generate a new random private key (32 bytes, hex).
   *
   * @example
   * const key = ZbxCrypto.generateKey();
   * // "a1b2c3d4..." (64 hex chars)
   */
  generateKey(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  },

  /**
   * Keccak-256 hash (used for address derivation, tx hashing).
   * NOTE: In production, use a real keccak library.
   * This is a SHA-256 placeholder for demo purposes.
   */
  async keccak256(input: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", input);
    return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, "0")).join("");
  },

  /**
   * Derive ZBX address from a public key.
   * ZBX uses same address format as Ethereum: keccak256(pubkey)[12:]
   */
  async pubkeyToAddress(pubkeyHex: string): Promise<string> {
    const bytes = hexToBytes(pubkeyHex);
    const hash  = await ZbxCrypto.keccak256(bytes);
    return "0x" + hash.slice(-40);
  },

  /**
   * Encode a value to RLP (Recursive Length Prefix).
   * Used for transaction serialization.
   */
  rlpEncode(value: string | Uint8Array | string[]): Uint8Array {
    if (Array.isArray(value)) {
      const encoded = value.map(v => ZbxCrypto.rlpEncode(v));
      const total   = encoded.reduce((s, b) => s + b.length, 0);
      const prefix  = rlpListPrefix(total);
      const result  = new Uint8Array(prefix.length + total);
      let offset = 0;
      result.set(prefix, offset); offset += prefix.length;
      for (const b of encoded) { result.set(b, offset); offset += b.length; }
      return result;
    }
    if (typeof value === "string") {
      return ZbxCrypto.rlpEncode(hexToBytes(value.startsWith("0x") ? value.slice(2) : value));
    }
    if (value.length === 0) return new Uint8Array([0x80]);
    if (value.length === 1 && value[0] < 0x80) return value;
    const prefix = rlpStringPrefix(value.length);
    const result = new Uint8Array(prefix.length + value.length);
    result.set(prefix); result.set(value, prefix.length);
    return result;
  },
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function rlpStringPrefix(len: number): Uint8Array {
  if (len < 56) return new Uint8Array([0x80 + len]);
  const lenBytes = numberToBytes(len);
  return new Uint8Array([0xb7 + lenBytes.length, ...lenBytes]);
}

function rlpListPrefix(len: number): Uint8Array {
  if (len < 56) return new Uint8Array([0xc0 + len]);
  const lenBytes = numberToBytes(len);
  return new Uint8Array([0xf7 + lenBytes.length, ...lenBytes]);
}

function numberToBytes(n: number): Uint8Array {
  const bytes: number[] = [];
  while (n > 0) { bytes.unshift(n & 0xff); n >>= 8; }
  return new Uint8Array(bytes);
}