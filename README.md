# @adsefid/sdk

[![CI](https://github.com/adsefid/sdk-js/actions/workflows/ci.yml/badge.svg)](https://github.com/adsefid/sdk-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40adsefid%2Fsdk.svg)](https://www.npmjs.com/package/@adsefid/sdk)

Official JavaScript/TypeScript client SDK for the [adsefid.com SMS Web Service](https://adsefid.com) REST API — SMS, Messenger (Rubika/Bale/etc.), and account/user endpoints, plus outgoing webhook signature verification.

## Requirements

- **Node.js 18+**
- **Server-side only.** This SDK holds your secret `X-API-KEY` and uses Node's built-in `node:crypto` module for webhook signature verification. It is not designed for and must not be used in browser/client-side code — bundling it into a frontend app would expose your API key to anyone who opens dev tools.

## Install

```bash
npm install @adsefid/sdk
```

## Quickstart

```ts
import { AdsefidClient } from "@adsefid/sdk";

const client = new AdsefidClient({ apiKey: process.env.ADSEFID_API_KEY! });

const result = await client.sms.sendSingle({
  receptor: "98912****567",
  line_number: "3000xxxx",
  message: "سلام، پیام تست",
});

console.log(result.message_id, result.status);
```

The package also works from plain CommonJS:

```js
const { AdsefidClient } = require("@adsefid/sdk");
```

Both module formats ship matching declaration files, so TypeScript and JavaScript editors resolve
the same public API automatically.

## Auth setup

The SDK never reads environment variables itself — there is no implicit env magic. Read `ADSEFID_API_KEY` (or whatever name you choose) yourself and pass it explicitly:

```ts
import { AdsefidClient } from "@adsefid/sdk";

const apiKey = process.env.ADSEFID_API_KEY;
if (!apiKey) {
  throw new Error("ADSEFID_API_KEY is not set");
}

const client = new AdsefidClient({ apiKey });
```

## Configuration

```ts
const client = new AdsefidClient({
  apiKey: process.env.ADSEFID_API_KEY!,

  // Override the base URL (default: "https://api.adsefid.com")
  baseUrl: "https://api.adsefid.com",

  // Supply a custom fetch implementation (polyfill, proxy-aware fetch, test double, ...)
  fetchImpl: fetch,

  // Per-request timeout in milliseconds (default: 30000)
  timeoutMs: 15_000,

  // Defaults to "adsefid-js/<SDK_VERSION>".
  userAgent: "my-service/1.0.0",
});
```

Monetary response fields (`cost`, `total_cost`, and `credit_left`) use `number` and may contain fractional values.

## Dates are plain ISO-8601 strings, not `Date` objects

Every datetime field in this SDK — `send_time`, `expiry_date`, `receive_date`, `delivery_time`, `since`, `created_at`, `updated_at`, `occurred_at` — is typed as a plain `string`, both in requests you send and responses you receive. **The SDK never converts these to JavaScript `Date` objects, and you should be careful not to either.**

The adsefid.com API returns timestamps with explicit UTC offsets like `+03:30` (Iran Standard Time). A native JS `Date` has no concept of "the offset the source used" — the moment you do `new Date("2026-04-04T10:30:00+03:30")`, the offset is normalized away and silently lost the instant you read it back out (`.toISOString()` always renders in UTC, `.toString()` renders in the *host machine's* local zone — neither preserves `+03:30`). Since the API's own semantics (e.g. "must be >= now + 1 minute") are offset-sensitive and this is a wire-format API, we keep the exact string the server gave you (or that you constructed) untouched all the way through. If you need to do date arithmetic, parse the string yourself with a timezone-aware library (e.g. `Temporal`, `date-fns-tz`, `luxon`) and re-serialize back to an ISO-8601 string with the offset you want before sending it back to the API.

## Resource reference

| Resource | SDK method | HTTP endpoint | Notes |
|---|---|---|---|
| `client.sms` | `sendSingle(req)` | `POST /v1/sms/single` | |
| `client.sms` | `sendBulk(req)` | `POST /v1/sms/bulk` | Partial success is a normal typed return |
| `client.sms` | `sendP2P(req)` | `POST /v1/sms/p2p` | Partial success is a normal typed return |
| `client.sms` | `sendTemplate(req)` | `POST /v1/sms/template` | |
| `client.sms` | `getStatus(query)` | `GET /v1/sms/status` | |
| `client.sms` | `cancel(req)` | `POST /v1/sms/cancel` | |
| `client.sms` | `getReceived(query)` | `GET /v1/sms/receive` | |
| `client.messenger` | `sendSingle(req)` | `POST /v1/messenger/single` | |
| `client.messenger` | `sendBulk(req)` | `POST /v1/messenger/bulk` | Partial success is a normal typed return |
| `client.messenger` | `sendP2P(req)` | `POST /v1/messenger/p2p` | Partial success is a normal typed return |
| `client.messenger` | `uploadFile(params)` | `POST /v1/messenger/file` | Accepts `Blob`, `ArrayBuffer`, or `ReadableStream` |
| `client.messenger` | `cancel(req)` | `POST /v1/messenger/cancel` | |
| `client.messenger` | `sendTemplate(req)` | `POST /v1/messenger/template` | |
| `client.messenger` | `getStatus(query)` | `GET /v1/messenger/status` | |
| `client.user` | `getInfo()` | `GET /v1/user/info` | |
| `client.user` | `getLines()` | `GET /v1/user/lines` | |
| `client.user` | `getProfiles()` | `GET /v1/user/profiles` | |
| `client.user` | `getTemplates(query?)` | `GET /v1/user/templates` | |

Every method **throws** on a non-success response envelope or a non-2xx HTTP status; a successful call returns the typed response object directly (no `Result`/`Either` wrapper). Bulk and P2P endpoints can return partial success (some receptors accepted, some rejected) — that is a normal typed return value, not a thrown error; inspect each item's `status` field.

## Error handling

```ts
import {
  AdsefidApiError,
  AdsefidRateLimitError,
  AdsefidTransportError,
  AdsefidValidationError,
  WebServiceResponseCode,
} from "@adsefid/sdk";

try {
  await client.sms.sendSingle({
    receptor: "98912****567",
    line_number: "3000xxxx",
    message: "hello",
  });
} catch (err) {
  if (err instanceof AdsefidRateLimitError) {
    console.warn("Rate limited:", err.codeName, err.details);
  } else if (err instanceof AdsefidApiError) {
    // err.code is a numeric WebServiceResponseCode (e.g. 2007)
    // err.codeName is the SCREAMING_SNAKE name (e.g. "DUPLICATE_LOCAL_ID")
    // err.details is endpoint-specific and untyped (validation map, item list, etc.)
    console.error(err.code, err.codeName, err.httpStatusCode, err.details);
    if (err.code === WebServiceResponseCode.DUPLICATE_LOCAL_ID) {
      // handle idempotency conflict
    }
  } else if (err instanceof AdsefidValidationError) {
    // Thrown client-side, before any request was sent (e.g. bad local_id format)
    console.error("Invalid request:", err.message, err.field);
  } else if (err instanceof AdsefidTransportError) {
    // Network failure, timeout, or unparsable response
    console.error("Transport failure:", err.message, err.cause);
  } else {
    throw err;
  }
}
```

`AdsefidApiError` deliberately does not use a property named `name` for the error's symbolic name (`"DUPLICATE_LOCAL_ID"`, `"INVALID_PARAMETER"`, ...) — that would shadow the inherited `Error.prototype.name` (which stays `"AdsefidApiError"`). Use `err.codeName` instead.

## Rate limits

The API enforces a default sending limit of 500 units/second, shared across SMS and Messenger traffic (SMS is counted per segment). If you exceed it, you get back:

- `2035 MESSAGE_LIMIT_REACHED`
- `2036 REQUEST_LIMIT_REACHED`

Both surface as `AdsefidRateLimitError` (a subclass of `AdsefidApiError`).

## Enum reference

All enums are plain `as const` objects (not TypeScript `enum`s), each with a derived union type of the same name:

- `LineSelector` — `PromotionalSendBased` (0) … `CustomerClubServiceDeliverBased` (5)
- `WebServiceMessageStatus` — `SCHEDULED` (1000) … `UNKNOWN` (1999)
- `WebServiceResponseCode` — `INTERNAL_ERROR` (2000) … `REJECTED` (2045), plus `WebServiceResponseCodeHttpStatus` mapping each code to its documented HTTP status
- `TemplateState` — `"pendingapproval" | "approved" | "rejected"`
- `TemplateParameterType` — `"string" | "number"` (the documented complete public set). The live
  service also emits an undocumented third value; such a parameter is dropped from
  `UserTemplate.parameters` rather than surfaced as a value the union says cannot exist.

## Template parameters, leading zeros and decimals

`TemplateParameterValue` is `string | number`, and `TemplateParameters` is a `Record` of them. A
parameter the template declares as `number` may be sent **either** as a JSON number or as a JSON
string, and the service substitutes a numeric string verbatim. Since JavaScript numbers are
IEEE-754 doubles, a string is the only way to express a value whose exact digits matter:

```ts
await client.sms.sendTemplate({
  template_id: "invoice_notice",
  parameters: {
    invoice: "001234", // renders as 001234 — the number 1234 would lose the zeros
    amount: "1.50",    // renders as 1.50   — the number 1.5 would lose the zero
    count: 2,          // an ordinary integer
    rate: 19.99,       // a decimal, where double rounding is acceptable
  },
  receptor: "09120000000",
  line_number: "3000xxxx",
});
```

Reach for a string whenever the rendered text must match the digits you supplied — invoice and
account numbers, zero-padded codes, and money amounts with a fixed number of decimal places. See
[`examples/templates.ts`](./examples/templates.ts) for a runnable version.

```ts
import { LineSelector, WebServiceMessageStatus } from "@adsefid/sdk";

await client.sms.sendBulk({
  line_selector: LineSelector.BulkServiceSendBased,
  // ...
});

if (status.receptors[0]?.status === WebServiceMessageStatus.DELIVERED) {
  // ...
}
```

## File upload example

```ts
import { readFile } from "node:fs/promises";

const fileBytes = await readFile("./brochure.pdf");

const { file_id } = await client.messenger.uploadFile({
  file: fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength),
  filename: "brochure.pdf",
  contentType: "application/pdf",
});

await client.messenger.sendSingle({
  message: "Here's our brochure",
  receptor: "98912****567",
  profile: "b72ea7f4-44b4-4f5e-91ef-91816ae5f88a",
  file_id,
});
```

`uploadFile` also accepts a `Blob` or a `ReadableStream<Uint8Array>` directly.

## Webhook verification example

A minimal Express/Node handler that verifies signature + timestamp before touching the payload:

```ts
import { createServer } from "node:http";
import {
  verifyAndParseWebhook,
  AdsefidWebhookVerificationError,
  WEBHOOK_HEADERS_LOWERCASE,
  WEBHOOK_EVENT_TYPES,
} from "@adsefid/sdk";

const secret = process.env.ADSEFID_WEBHOOK_SECRET!;

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);

    let event;
    try {
      event = verifyAndParseWebhook({
        rawBody,
        signatureHeader: String(req.headers[WEBHOOK_HEADERS_LOWERCASE.signature] ?? ""),
        timestampHeader: String(req.headers[WEBHOOK_HEADERS_LOWERCASE.timestamp] ?? ""),
        secret,
      });
    } catch (err) {
      if (err instanceof AdsefidWebhookVerificationError) {
        res.writeHead(401).end("invalid signature");
        return;
      }
      throw err;
    }

    // Only event types this webhook endpoint is subscribed to (in your adsefid.com panel) ever
    // arrive here — an endpoint subscribed to just "receive" never sees a "status" event.
    switch (event.type) {
      case WEBHOOK_EVENT_TYPES.receive:
        for (const item of event.data) {
          console.log("inbound SMS", item.sender, item.message);
        }
        break;
      case WEBHOOK_EVENT_TYPES.status:
        for (const item of event.data) {
          console.log("SMS status", item.id, item.status_delivery);
        }
        break;
      case WEBHOOK_EVENT_TYPES.messengerStatus:
        for (const item of event.data) {
          console.log("messenger status", item.id, item.status_delivery);
        }
        break;
    }

    // Return 2xx quickly; do heavier processing asynchronously.
    res.writeHead(200).end("ok");
  });
});

server.listen(3000);
```

If you're using a framework that already parses the body (e.g. Express's `express.json()`), make sure you also capture the *raw* request body bytes for signature verification — the middleware's parsed object is not byte-identical to what was signed.

### The signing secret is Base64

Your endpoint's signing secret is shown in the adsefid.com panel as the Base64 encoding of 32
random bytes, and the platform signs with **those raw bytes** — not with the text of the Base64
string. Pass the secret exactly as the panel shows it and `verifyAndParseWebhook` decodes it for
you; a secret that is not valid Base64 throws `AdsefidWebhookVerificationError`. If you already
hold the decoded key, pass it as a `Uint8Array` instead.

`WEBHOOK_HEADERS`/`WEBHOOK_HEADERS_LOWERCASE` export every header name as a constant so you never
have to type `"x-atlas-webhook-signature"` yourself; `WEBHOOK_EVENT_TYPES` does the same for the
`type` values. You configure, per webhook endpoint, which event types it receives (in your
adsefid.com panel) — an endpoint subscribed only to `receive` will never see a `"status"` event,
so don't assume every deployment gets all three; handle whichever ones you've subscribed to.

## Versioning

This SDK follows Semantic Versioning independently of the API documentation.

- SDK version: **`0.3.0`** (`version` in `package.json`)
- Verified API documentation: **`v1.11.0`**

SDK releases use `v<SDK_VERSION>` tags. The two version numbers move independently.

## Development

Requires **Node.js 18+**. Development tools are pinned in `package.json`; the published package has
zero runtime dependencies.

```bash
make deps   # npm install
make fmt    # npm run format  (biome check --write .)
make lint   # npm run lint    (biome check .) + tsc --noEmit on src and tests
make build  # npm run build   (tsup — emits ESM, CJS, and .d.ts into dist/)
make test   # npm test        (vitest run)
```

`vitest` is a devDependency only; the published package still has zero runtime dependencies. Golden
fixtures under `tests/fixtures/` are byte-identical to the same tree in the sibling SDK
repositories, and `tests/fixtures.test.ts` verifies them against `CHECKSUMS.txt`.

### Examples

Runnable usage samples live in [`examples/`](./examples) (not published to npm — see `"files"` in
`package.json`). Run one directly with `tsx`:

```bash
export ADSEFID_API_KEY=...
export ADSEFID_LINE_NUMBER=3000xxxx

npx tsx examples/account.ts            # account info, lines, profiles, templates; client config
npx tsx examples/quickstart.ts         # send one SMS, with full error triage
npx tsx examples/bulk-and-p2p.ts       # bulk + P2P sends, and reading a partial success
npx tsx examples/templates.ts          # list templates and send one, incl. exact numeric values
npx tsx examples/status-and-cancel.ts  # delivery status, cancelling, inbound messages
npx tsx examples/messenger.ts          # upload an attachment and send it via a messenger profile

ADSEFID_WEBHOOK_SECRET=... npx tsx examples/webhook-server.ts
```

`examples/account.ts` sends nothing, so it is the safest one to try first.

## License

MIT — see [LICENSE](LICENSE).
