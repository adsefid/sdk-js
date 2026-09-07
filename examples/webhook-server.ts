/**
 * Minimal plain node:http webhook receiver. Verifies the signature and
 * timestamp headers, then prints a summary per event type. Run with:
 *
 *   ADSEFID_WEBHOOK_SECRET=... npx tsx examples/webhook-server.ts
 */
import { createServer, type IncomingMessage } from "node:http";
import {
  AdsefidWebhookVerificationError,
  verifyAndParseWebhook,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_HEADERS_LOWERCASE,
} from "../src/index.js";
import type { WebhookEvent } from "../src/webhooks/events.js";

const secret = process.env.ADSEFID_WEBHOOK_SECRET;
if (!secret) {
  throw new Error("Set ADSEFID_WEBHOOK_SECRET before running this example.");
}

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = createServer((req, res) => {
  readRawBody(req)
    .then((rawBody) => {
      let event: WebhookEvent;
      try {
        event = verifyAndParseWebhook({
          rawBody,
          signatureHeader: String(req.headers[WEBHOOK_HEADERS_LOWERCASE.signature] ?? ""),
          timestampHeader: String(req.headers[WEBHOOK_HEADERS_LOWERCASE.timestamp] ?? ""),
          secret,
        });
      } catch (err) {
        if (err instanceof AdsefidWebhookVerificationError) {
          console.error("Webhook rejected:", err.message);
          res.writeHead(401).end("invalid signature");
          return;
        }
        throw err;
      }

      // Only event types this webhook endpoint is subscribed to (in your adsefid.com panel) ever
      // arrive here — an endpoint subscribed to just "receive" never sees a "status" event.
      switch (event.type) {
        case WEBHOOK_EVENT_TYPES.receive:
          console.log(`[receive] ${event.data.length} inbound message(s)`);
          for (const item of event.data) {
            console.log(
              `  #${item.id} from ${item.sender} on ${item.line_number}: ${item.message}`,
            );
          }
          break;
        case WEBHOOK_EVENT_TYPES.status:
          console.log(`[status] ${event.data.length} SMS status update(s)`);
          for (const item of event.data) {
            console.log(`  ${item.id} (local_id=${item.local_id}) -> ${item.status_delivery}`);
          }
          break;
        case WEBHOOK_EVENT_TYPES.messengerStatus:
          console.log(`[messenger.status] ${event.data.length} messenger status update(s)`);
          for (const item of event.data) {
            console.log(`  ${item.id} (local_id=${item.local_id}) -> ${item.status_delivery}`);
          }
          break;
      }

      // Return 2xx quickly; do heavier processing asynchronously.
      res.writeHead(200).end("ok");
    })
    .catch((err) => {
      console.error("Unexpected error handling webhook:", err);
      res.writeHead(500).end("internal error");
    });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Webhook server listening on http://localhost:${port}`);
});
