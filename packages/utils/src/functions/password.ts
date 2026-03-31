/** biome-ignore-all lint/complexity/noStaticOnlyClass: forced */

import { pbkdf2 as nodePbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const SALT_LENGTH = 16;
const HASH_LENGTH = 32;
const PBKDF2_ITERATIONS = 50_000;
const PBKDF2_DIGEST = "sha256";
const pbkdf2 = promisify(nodePbkdf2);

export class PasswordUtils {
  // Hash password using Node's native crypto for Hono Node server compatibility and speed.
  static async hash(password: string): Promise<string> {
    if (!password || typeof password !== "string") {
      throw new Error("Password must be a non-empty string");
    }

    const salt = randomBytes(SALT_LENGTH);
    const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, HASH_LENGTH, PBKDF2_DIGEST);

    // Keep same persisted format as before: base64(salt + hash)
    return Buffer.concat([salt, hash]).toString("base64");
  }

  // Verify password against hash
  static async verify(password: string, hash: string): Promise<boolean> {
    if (!(password && hash)) {
      return false;
    }

    try {
      const combined = Buffer.from(hash, "base64");
      if (combined.length !== SALT_LENGTH + HASH_LENGTH) {
        return false;
      }

      const salt = combined.subarray(0, SALT_LENGTH);
      const originalHash = combined.subarray(SALT_LENGTH);

      const newHash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, HASH_LENGTH, PBKDF2_DIGEST);

      return timingSafeEqual(newHash, originalHash);
    } catch {
      return false;
    }
  }
}

export const generateRandomPassword = (length: number = 10): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};
