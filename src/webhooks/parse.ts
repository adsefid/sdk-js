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

export const DEFAULT_MAX_AGE_SECONDS = 300;
export const INVALID_SECRET_MESSAGE =
  "Webhook secret is not valid Base64; use the secret exactly as shown in your adsefid.com panel, or pass the decoded key as a Uint8Array";
export const SIGNATURE_MISMATCH_MESSAGE = "Webhook signature mismatch";

const SIGNATURE_PREFIX = "v1=";
const KNOWN_EVENT_TYPES: ReadonlySet<WebhookEvent["type"]> = new Set(
  Object.values(WEBHOOK_EVENT_TYPES),
);

export function isCanonicalBase64(input: string, reencoded: string): boolean {
  return reencoded.replace(/=+$/, "") === input.replace(/=+$/, "");
}

export function parseTimestampHeader(timestampHeader: string): number {
  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp) || String(timestamp) !== timestampHeader.trim()) {
    throw new AdsefidWebhookVerificationError(`Invalid timestamp header: "${timestampHeader}"`);
  }
  return timestamp;
}

export function parseSignatureHeader(signatureHeader: string): string {
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    throw new AdsefidWebhookVerificationError(
      `Signature header must start with "${SIGNATURE_PREFIX}"`,
    );
  }
  return signatureHeader.slice(SIGNATURE_PREFIX.length);
}

export function signingPrefix(timestamp: number): string {
  return `${timestamp}.`;
}

export function assertFresh(timestamp: number, maxAgeSeconds: number): void {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > maxAgeSeconds) {
    throw new AdsefidWebhookVerificationError(
      `Webhook timestamp is stale: ${Math.abs(nowSeconds - timestamp)}s old, max allowed is ${maxAgeSeconds}s`,
    );
  }
}

export function parseWebhookBody(bodyText: string): WebhookEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
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
