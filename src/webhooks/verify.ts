import { createHmac, timingSafeEqual } from "node:crypto";
import { dateFromWire, nullableDateFromWire, type Wire } from "../dates.js";
import { AdsefidWebhookVerificationError } from "../errors.js";
import type {
  MessengerStatusWebhookEvent,
  ReceiveWebhookEvent,
  StatusWebhookEvent,
  StatusWebhookItem,
  WebhookEvent,
} from "./events.js";
import { WEBHOOK_EVENT_TYPES } from "./headers.js";

const SIGNATURE_PREFIX = "v1=";
const DEFAULT_MAX_AGE_SECONDS = 300;
const KNOWN_EVENT_TYPES: ReadonlySet<WebhookEvent["type"]> = new Set(
  Object.values(WEBHOOK_EVENT_TYPES),
);

export interface VerifyAndParseWebhookParams {
  /**
   * The exact request body as received. Re-serializing or reformatting it
   * first breaks verification, so prefer the raw `Buffer`.
   */
  rawBody: string | Buffer;
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

/**
 * Turns the panel's secret into the raw HMAC key.
 *
 * A webhook endpoint's secret is 32 random bytes, and the adsefid.com panel
 * shows it Base64-encoded. The platform signs with those *decoded* bytes, so
 * the Base64 has to be undone before it is used as a key.
 */
function decodeSecret(secret: string | Uint8Array): Buffer {
  if (typeof secret !== "string") {
    return Buffer.from(secret);
  }

  const trimmed = secret.trim();
  const decoded = Buffer.from(trimmed, "base64");
  // Buffer.from(..., "base64") silently ignores invalid input, so round-trip
  // to confirm the secret really was Base64 rather than hand it a wrong key.
  if (
    decoded.length === 0 ||
    decoded.toString("base64").replace(/=+$/, "") !== trimmed.replace(/=+$/, "")
  ) {
    throw new AdsefidWebhookVerificationError(
      "Webhook secret is not valid Base64; use the secret exactly as shown in your adsefid.com panel, or pass the decoded key as a Uint8Array",
    );
  }
  return decoded;
}

/**
 * Verifies an adsefid.com outgoing webhook's HMAC-SHA256 signature and
 * timestamp freshness (doc §7.3), then parses and returns the typed event
 * payload. Throws `AdsefidWebhookVerificationError` on any failure.
 */
export function verifyAndParseWebhook(params: VerifyAndParseWebhookParams): WebhookEvent {
  const { rawBody, signatureHeader, timestampHeader, secret } = params;
  const maxAgeSeconds = params.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;

  const key = decodeSecret(secret);

  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp) || String(timestamp) !== timestampHeader.trim()) {
    throw new AdsefidWebhookVerificationError(`Invalid timestamp header: "${timestampHeader}"`);
  }

  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    throw new AdsefidWebhookVerificationError(
      `Signature header must start with "${SIGNATURE_PREFIX}"`,
    );
  }
  const providedSignature = signatureHeader.slice(SIGNATURE_PREFIX.length);

  const rawBodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  // Hash the body bytes as they arrived. Decoding to a string and re-encoding
  // would round-trip through UTF-8 and could change what gets signed.
  // Base64-encoded directly from the raw HMAC digest bytes — no hex step.
  const expectedSignature = createHmac("sha256", key)
    .update(Buffer.from(`${timestamp}.`, "utf8"))
    .update(rawBodyBuffer)
    .digest("base64");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const signaturesMatch =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  // Signature first, then freshness — the sibling SDKs check in this order, so
  // the same request reports the same failure everywhere.
  if (!signaturesMatch) {
    throw new AdsefidWebhookVerificationError("Webhook signature mismatch");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > maxAgeSeconds) {
    throw new AdsefidWebhookVerificationError(
      `Webhook timestamp is stale: ${Math.abs(nowSeconds - timestamp)}s old, max allowed is ${maxAgeSeconds}s`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBodyBuffer.toString("utf8"));
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
  const occurredAt = dateFromWire(
    record.occurred_at,
    "occurred_at",
    AdsefidWebhookVerificationError,
  );

  switch (type) {
    case WEBHOOK_EVENT_TYPES.receive: {
      const event = value as Wire<ReceiveWebhookEvent>;
      return {
        ...event,
        occurred_at: occurredAt,
        data: event.data.map((item, index) => {
          const record = webhookItem(item, index);
          return {
            ...record,
            receive_date: dateFromWire(
              record.receive_date,
              `data[${index}].receive_date`,
              AdsefidWebhookVerificationError,
            ),
          };
        }),
      };
    }
    case WEBHOOK_EVENT_TYPES.status: {
      const event = value as Wire<StatusWebhookEvent>;
      return { ...event, occurred_at: occurredAt, data: parseStatusItems(event.data) };
    }
    case WEBHOOK_EVENT_TYPES.messengerStatus: {
      const event = value as Wire<MessengerStatusWebhookEvent>;
      return { ...event, occurred_at: occurredAt, data: parseStatusItems(event.data) };
    }
    default:
      throw new AdsefidWebhookVerificationError(`Unknown webhook event type: ${String(type)}`);
  }
}

function parseStatusItems(items: Wire<StatusWebhookItem>[]): StatusWebhookItem[] {
  return items.map((item, index) => {
    const record = webhookItem(item, index);
    return {
      ...record,
      delivery_time: nullableDateFromWire(
        record.delivery_time,
        `data[${index}].delivery_time`,
        AdsefidWebhookVerificationError,
      ),
    };
  });
}

function webhookItem<TItem extends object>(value: TItem, index: number): TItem {
  if (typeof value !== "object" || value === null) {
    throw new AdsefidWebhookVerificationError(`'data[${index}]' must be an object.`);
  }
  return value;
}
