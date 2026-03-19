/** biome-ignore-all lint/style/useBlockStatements: forced */
/** biome-ignore-all lint/performance/useTopLevelRegex: forced */
import nacl from "tweetnacl";
import util from "tweetnacl-util";

// Pre-allocated nonce padding buffer (reusable)
const PADDED_NONCE_TEMPLATE = new Uint8Array(24);

// Regex for URL-safe base64 decoding (combined operations)
const BASE64_DECODE_REGEX = /[-_]/g;

/**
 * Derive 32-byte key from secret using SHA-512 (fast path)
 */
function deriveKey(secret: string | Uint8Array): Uint8Array {
  const input = secret instanceof Uint8Array ? secret : util.decodeUTF8(secret as string);
  return nacl.hash(input).slice(0, 32);
}

/**
 * Encode to URL-safe base64 - optimized with Buffer
 */
function encodeBase64URL(data: Uint8Array): string {
  // Use Buffer for faster encoding in Node.js environment
  let encoded: string;
  if (typeof Buffer !== "undefined") {
    encoded = Buffer.from(data).toString("base64");
  } else {
    // Fallback for browser (chunked to avoid stack overflow)
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += 0x80_00) {
      chunks.push(String.fromCharCode(...data.slice(i, i + 0x80_00)));
    }
    encoded = btoa(chunks.join(""));
  }

  // Single regex for URL-safe conversion
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decode from URL-safe base64 - optimized single regex
 */
function decodeBase64URL(encoded: string): Uint8Array {
  // Restore standard base64 characters
  let padded = encoded.replace(BASE64_DECODE_REGEX, (match) => (match === "-" ? "+" : "/"));

  // Calculate padding
  const remainder = padded.length % 4;
  if (remainder) {
    padded += "=".repeat(4 - remainder);
  }

  // Use Buffer if available for faster decoding
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }

  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/**
 * Fast nonce padding helper
 */
function getPaddedNonce(nonce: Uint8Array): Uint8Array {
  const padded = PADDED_NONCE_TEMPLATE.slice();
  padded.set(nonce, 0);
  return padded;
}

/**
 * Encrypt password (max 10 chars) - optimized
 */
export function encryptPassword(password: string, secret: string | Uint8Array): string {
  if (!password || password.length === 0) {
    throw new Error("Password required");
  }

  if (password.length > 10) {
    throw new Error("Password must be <= 10 characters");
  }

  const SECRET_KEY = deriveKey(secret);
  const message = util.decodeUTF8(password);
  const nonce = nacl.randomBytes(8);
  const encrypted = nacl.secretbox(message, getPaddedNonce(nonce), SECRET_KEY);

  // Single allocation and copy
  const combined = new Uint8Array(8 + encrypted.length);
  combined.set(nonce, 0);
  combined.set(encrypted, 8);

  return encodeBase64URL(combined);
}

/**
 * Decrypt password - optimized
 */
export function decryptPassword(token: string, secret: string | Uint8Array): string {
  if (!token) {
    throw new Error("Token required");
  }

  try {
    const combined = decodeBase64URL(token);

    if (combined.length < 24) {
      throw new Error("Invalid token");
    }

    const nonce = combined.slice(0, 8);
    const ciphertext = combined.slice(8);
    const decrypted = nacl.secretbox.open(ciphertext, getPaddedNonce(nonce), deriveKey(secret));

    if (!decrypted) {
      throw new Error("Invalid token or wrong secret");
    }

    return util.encodeUTF8(decrypted);
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

/**
 * Verify token validity - optimized
 */
export function isPasswordTokenValid(token: string, secret: string | Uint8Array): boolean {
  try {
    const combined = decodeBase64URL(token);
    if (combined.length < 24) return false;

    return (
      nacl.secretbox.open(
        combined.slice(8),
        getPaddedNonce(combined.slice(0, 8)),
        deriveKey(secret)
      ) !== null
    );
  } catch {
    return false;
  }
}
