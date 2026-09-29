import { AdsefidWebhookVerificationError } from "../errors.js";
import type { WebhookEvent } from "./events.js";
import {
  assertFresh,
  DEFAULT_MAX_AGE_SECONDS,
  INVALID_SECRET_MESSAGE,
  isCanonicalBase64,
  parseSignatureHeader,
  parseTimestampHeader,
  parseWebhookBody,
  SIGNATURE_MISMATCH_MESSAGE,
  signingPrefix,
} from "./parse.js";

export interface VerifyAndParseWebhookParams {
  /**
   * The exact request body as received. Re-serializing or reformatting it
   * first breaks verification, so prefer the raw bytes (a Node.js `Buffer` is a
   * `Uint8Array`).
   */
  rawBody: string | Uint8Array | ArrayBuffer;
  signatureHeader: string;
  timestampHeader: string;
  /**
   * The endpoint's signing secret as shown in your adsefid.com panel, which is
   * Base64 and is decoded here, or the already-decoded key as a `Uint8Array`.
   */
  secret: string | Uint8Array;
  /** Max allowed age of the timestamp header, in seconds. Default `300`. */
  maxAgeSeconds?: number;
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Turns the panel's secret into the raw HMAC key.
 *
 * A webhook endpoint's secret is 32 random bytes, and the adsefid.com panel
 * shows it Base64-encoded. The platform signs with those *decoded* bytes, so
 * the Base64 has to be undone before it is used as a key.
 */
function decodeSecret(secret: string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof secret !== "string") {
    return Uint8Array.from(secret);
  }

  const trimmed = secret.trim();
  let binary: string;
  try {
    binary = atob(trimmed);
  } catch {
    throw new AdsefidWebhookVerificationError(INVALID_SECRET_MESSAGE);
  }
  const decoded = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  // Round-trip so a lenient decoder cannot turn a mistyped secret into a wrong key.
  if (decoded.length === 0 || !isCanonicalBase64(trimmed, bytesToBase64(decoded))) {
    throw new AdsefidWebhookVerificationError(INVALID_SECRET_MESSAGE);
  }
  return decoded;
}

function toBytes(rawBody: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof rawBody === "string") {
    return utf8Encoder.encode(rawBody);
  }
  return rawBody instanceof Uint8Array ? rawBody : new Uint8Array(rawBody);
}

function constantTimeEqual(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Verifies an adsefid.com outgoing webhook's HMAC-SHA256 signature and
 * timestamp freshness (doc §7.3), then parses and returns the typed event
 * payload. Rejects with `AdsefidWebhookVerificationError` on any failure.
 *
 * Built only on Web Crypto, so it runs on Node.js 22+, Bun, Deno, and edge or
 * sandboxed runtimes. It is async because Web Crypto is.
 */
export async function verifyAndParseWebhook(
  params: VerifyAndParseWebhookParams,
): Promise<WebhookEvent> {
  const { rawBody, signatureHeader, timestampHeader, secret } = params;
  const maxAgeSeconds = params.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;

  const key = decodeSecret(secret);
  const timestamp = parseTimestampHeader(timestampHeader);
  const providedSignature = parseSignatureHeader(signatureHeader);

  // Hash the body bytes as they arrived, prefixed by "{timestamp}.". Decoding to a
  // string and re-encoding would round-trip through UTF-8 and could change them.
  const bodyBytes = toBytes(rawBody);
  const prefixBytes = utf8Encoder.encode(signingPrefix(timestamp));
  const signedBytes = new Uint8Array(prefixBytes.length + bodyBytes.length);
  signedBytes.set(prefixBytes, 0);
  signedBytes.set(bodyBytes, prefixBytes.length);

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // Base64-encoded directly from the raw HMAC digest bytes — no hex step.
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, signedBytes));
  const expectedSignature = bytesToBase64(digest);

  // Signature first, then freshness — the sibling SDKs check in this order, so
  // the same request reports the same failure everywhere.
  if (!constantTimeEqual(expectedSignature, providedSignature)) {
    throw new AdsefidWebhookVerificationError(SIGNATURE_MISMATCH_MESSAGE);
  }
  assertFresh(timestamp, maxAgeSeconds);

  return parseWebhookBody(utf8Decoder.decode(bodyBytes));
}
