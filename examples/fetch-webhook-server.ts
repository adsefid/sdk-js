/**
 * Runtime-neutral webhook receiver: a standard `fetch(request)` handler that runs
 * unchanged on Bun, Deno, and Cloudflare Workers. Build the package first
 * (`npm run build`), then:
 *
 *   ADSEFID_WEBHOOK_SECRET=... bun run examples/fetch-webhook-server.ts
 *   ADSEFID_WEBHOOK_SECRET=... deno serve --allow-env --allow-read examples/fetch-webhook-server.ts
 *
 * On Workers, bind `ADSEFID_WEBHOOK_SECRET` as a secret; it arrives in `env`.
 */
import {
  AdsefidWebhookVerificationError,
  verifyAndParseWebhook,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_HEADERS_LOWERCASE,
  type WebhookEvent,
} from "@adsefid/sdk";

interface Env {
  ADSEFID_WEBHOOK_SECRET?: string;
}

declare const process: { env: Env } | undefined;

function describe(event: WebhookEvent): string {
  switch (event.type) {
    case WEBHOOK_EVENT_TYPES.receive:
      return `${event.data.length} inbound message(s)`;
    case WEBHOOK_EVENT_TYPES.status:
      return `${event.data.length} SMS status update(s)`;
    case WEBHOOK_EVENT_TYPES.messengerStatus:
      return `${event.data.length} Messenger status update(s)`;
  }
}

export default {
  async fetch(request: Request, env: Env = {}): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
    }

    const secret =
      env.ADSEFID_WEBHOOK_SECRET ??
      (typeof process === "undefined" ? undefined : process.env.ADSEFID_WEBHOOK_SECRET);
    if (!secret) {
      return new Response("Webhook secret is not configured", { status: 503 });
    }

    try {
      const event = await verifyAndParseWebhook({
        rawBody: new Uint8Array(await request.arrayBuffer()),
        signatureHeader: request.headers.get(WEBHOOK_HEADERS_LOWERCASE.signature) ?? "",
        timestampHeader: request.headers.get(WEBHOOK_HEADERS_LOWERCASE.timestamp) ?? "",
        secret,
      });
      console.log(`${event.type} ${event.id}: ${describe(event)}`);
      return Response.json({ ok: true });
    } catch (error) {
      if (error instanceof AdsefidWebhookVerificationError) {
        console.warn(`Rejected webhook: ${error.message}`);
        return new Response("Invalid signature", { status: 401 });
      }
      throw error;
    }
  },
};
