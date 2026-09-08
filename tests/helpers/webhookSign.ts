import { createHmac } from "node:crypto";

export const SIGNATURE_PREFIX = "v1=";

/**
 * Reproduces the platform's signing: HMAC-SHA256 over `"{timestamp}.{rawBody}"`
 * keyed with the DECODED secret bytes. The panel shows the secret Base64-encoded;
 * the key is what that decodes to.
 */
export function sign(secretBase64: string, timestamp: string, rawBody: Buffer): string {
  const key = Buffer.from(secretBase64, "base64");
  const digest = createHmac("sha256", key)
    .update(Buffer.from(`${timestamp}.`, "utf8"))
    .update(rawBody)
    .digest("base64");
  return SIGNATURE_PREFIX + digest;
}

export function nowTimestamp(offsetSeconds = 0): string {
  return String(Math.floor(Date.now() / 1000) + offsetSeconds);
}
