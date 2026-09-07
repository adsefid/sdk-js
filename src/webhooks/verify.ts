import { createHmac, timingSafeEqual } from "node:crypto";
import { AdsefidWebhookVerificationError } from "../errors.js";
import type { WebhookEvent } from "./events.js";
import { WEBHOOK_EVENT_TYPES } from "./headers.js";

const SIGNATURE_PREFIX = "v1=";
const DEFAULT_MAX_AGE_SECONDS = 300;
const KNOWN_EVENT_TYPES: ReadonlySet<WebhookEvent["type"]> = new Set(
  Object.values(WEBHOOK_EVENT_TYPES),
);

export interface VerifyAndParseWebhookParams {
  rawBody: string | Buffer;
  signatureHeader: string;
  timestampHeader: string;
  secret: string;
  /** Max allowed age of the timestamp header, in seconds. Default `300`. */
  maxAgeSeconds?: number;
}

/**
 * Verifies an adsefid.com outgoing webhook's HMAC-SHA256 signature and
 * timestamp freshness (doc §7.3), then parses and returns the typed event
 * payload. Throws `AdsefidWebhookVerificationError` on any failure.
 */
export function verifyAndParseWebhook(params: VerifyAndParseWebhookParams): WebhookEvent {
  const { rawBody, signatureHeader, timestampHeader, secret } = params;
  const maxAgeSeconds = params.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;

  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp) || String(timestamp) !== timestampHeader.trim()) {
    throw new AdsefidWebhookVerificationError(`Invalid timestamp header: "${timestampHeader}"`);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > maxAgeSeconds) {
    throw new AdsefidWebhookVerificationError(
      `Webhook timestamp is stale: ${Math.abs(nowSeconds - timestamp)}s old, max allowed is ${maxAgeSeconds}s`,
    );
  }

  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    throw new AdsefidWebhookVerificationError(
      `Signature header must start with "${SIGNATURE_PREFIX}"`,
    );
  }
  const providedSignature = signatureHeader.slice(SIGNATURE_PREFIX.length);

  const rawBodyString = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const signingInput = `${timestamp}.${rawBodyString}`;
  // Base64-encoded directly from the raw HMAC digest bytes — no hex step.
  const expectedSignature = createHmac("sha256", secret)
    .update(signingInput, "utf8")
    .digest("base64");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const signaturesMatch =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  if (!signaturesMatch) {
    throw new AdsefidWebhookVerificationError("Webhook signature mismatch");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBodyString);
  } catch (err) {
    throw new AdsefidWebhookVerificationError(
      `Webhook body is not valid JSON: ${(err as Error).message}`,
    );
  }

  return parseWebhookEvent(parsed);
}

function parseWebhookEvent(value: unknown): WebhookEvent {
  if (typeof value !== "object" || value === null) {
    throw new AdsefidWebhookVerificationError("Webhook payload is not an object");
  }
  const record = value as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== "string" || !KNOWN_EVENT_TYPES.has(type as WebhookEvent["type"])) {
    throw new AdsefidWebhookVerificationError(`Unknown webhook event type: ${String(type)}`);
  }
  if (
    typeof record.id !== "string" ||
    typeof record.occurred_at !== "string" ||
    typeof record.attempt !== "number" ||
    typeof record.version !== "string" ||
    !Array.isArray(record.data)
  ) {
    throw new AdsefidWebhookVerificationError("Webhook payload is missing required fields");
  }
  return value as WebhookEvent;
}
