/**
 * Header names used by adsefid.com outgoing webhook deliveries. Node normalizes incoming
 * header keys to lowercase (`req.headers["x-atlas-webhook-signature"]`), so lowercase these
 * when indexing into `IncomingMessage.headers` — see `WEBHOOK_HEADERS_LOWERCASE` below, or
 * call `.toLowerCase()` yourself.
 */
export const WEBHOOK_HEADERS = {
  id: "X-Atlas-Webhook-Id",
  signature: "X-Atlas-Webhook-Signature",
  timestamp: "X-Atlas-Webhook-Timestamp",
  event: "X-Atlas-Webhook-Event",
  attempt: "X-Atlas-Webhook-Attempt",
} as const;

/** Same header names, pre-lowercased for direct use with Node's `IncomingMessage.headers`. */
export const WEBHOOK_HEADERS_LOWERCASE = {
  id: WEBHOOK_HEADERS.id.toLowerCase(),
  signature: WEBHOOK_HEADERS.signature.toLowerCase(),
  timestamp: WEBHOOK_HEADERS.timestamp.toLowerCase(),
  event: WEBHOOK_HEADERS.event.toLowerCase(),
  attempt: WEBHOOK_HEADERS.attempt.toLowerCase(),
} as const;

/** The `type` field values a webhook payload can carry, per doc §7.1. */
export const WEBHOOK_EVENT_TYPES = {
  receive: "receive",
  status: "status",
  messengerStatus: "messenger.status",
} as const;
