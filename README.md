# @adsefid/sdk

[![CI](https://github.com/adsefid/sdk-js/actions/workflows/ci.yml/badge.svg)](https://github.com/adsefid/sdk-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40adsefid%2Fsdk.svg)](https://www.npmjs.com/package/@adsefid/sdk)

A JavaScript and TypeScript client for the [adsefid.com](https://adsefid.com) SMS Web Service
API. It sends SMS and Messenger messages (single, bulk, P2P and template), checks delivery status,
cancels unsent messages, reads inbound SMS, looks up account data, and verifies signed webhooks.

It is built only on Web-standard APIs (`fetch`, `FormData`, `Blob`, `AbortController`, Web
Crypto), has no runtime dependencies, and ships its own types. It is verified against API
documentation **v1.14.0**. Sibling SDKs exist for .NET, Go, PHP and Python with the same shape.

**Server-side only.** The SDK holds your secret API key. Never bundle it into browser code.

## Install

| Runtime | Version | Install |
|---|---|---|
| Node.js | 22+ | `npm install @adsefid/sdk` |
| Bun | 1.2+ | `bun add @adsefid/sdk` |
| Deno | 2.0+ | `deno add npm:@adsefid/sdk` (run with `--allow-net=api.adsefid.com`) |
| Edge runtimes | any with `fetch` and Web Crypto, such as Cloudflare Workers | your bundler |

Both ESM and CommonJS work (`require("@adsefid/sdk")`), with matching type declarations.

## Quickstart

```ts
import { AdsefidClient, LineSelector } from "@adsefid/sdk";

const client = new AdsefidClient({ apiKey: process.env.ADSEFID_API_KEY! });

const result = await client.sms.sendSingle({
  receptor: "989120000000",
  line_number: "983000",
  line_selector: LineSelector.BulkServiceSendBased,
  message: "سلام، پیام تست",
});

console.log(result.message_id, result.status);
```

The SDK never reads environment variables. Pass the API key yourself. It goes out as the
`X-API-KEY` header on every request. Create one client and reuse it.

**Line selector.** An account can own several lines with the same number, each with its own
selector (see `client.user.getLines()`). When it does, `line_selector` is required on every SMS
send; without it the service answers `LINE_NOT_FOUND`.

## Configuration

```ts
const client = new AdsefidClient({
  apiKey,
  baseUrl: "https://api.adsefid.com", // default; must be an absolute http(s) URL
  timeoutMs: 15_000,                  // positive and finite; default 30000
  userAgent: "my-service/1.0.0",      // default: adsefid-js/<SDK_VERSION>
  fetchImpl: fetch,                   // custom fetch: proxy, polyfill, test double
});
```

The constructor throws `AdsefidValidationError` for a blank key, a bad URL or a bad timeout.

To cancel one call, pass `{ signal }` as the last argument of any method. Aborting rejects with
an `AdsefidTransportError`, and `timeoutMs` still applies:

```ts
const controller = new AbortController();
const info = await client.user.getInfo({ signal: controller.signal });
```

### Dates and money

Every datetime field is a native `Date`: pass `Date` objects in, and get `Date` objects out
(`Date | null` where the service may leave a value unset). A `Date` keeps the instant but not the
source UTC offset. An invalid request date throws `AdsefidValidationError`.

Money fields (`cost`, `total_cost`, `credit_left`) are JavaScript numbers (IEEE-754 doubles), so
very long fractions can lose precision. Round for display.

## Methods

| Resource | Methods | Endpoint |
|---|---|---|
| `client.sms` | `sendSingle`, `sendBulk`, `sendP2P`, `sendTemplate` | `POST /v1/sms/{single,bulk,p2p,template}` |
| `client.sms` | `getStatus`, `cancel`, `getReceived` | `GET /v1/sms/status`, `POST /v1/sms/cancel`, `GET /v1/sms/receive` |
| `client.messenger` | `sendSingle`, `sendBulk`, `sendP2P`, `sendTemplate` | `POST /v1/messenger/{single,bulk,p2p,template}` |
| `client.messenger` | `uploadFile({ file, filename, contentType })` | `POST /v1/messenger/file` |
| `client.messenger` | `getStatus`, `cancel` | `GET /v1/messenger/status`, `POST /v1/messenger/cancel` |
| `client.user` | `getInfo`, `getLines`, `getProfiles`, `getTemplates(query?)` | `GET /v1/user/{info,lines,profiles,templates}` |

Field names are snake_case, exactly as in the API. Cancel accepts messages that are awaiting
approval, queued or scheduled, with no refund, and at most 2,000 distinct IDs across both lists.
Status lookups are GET requests, so the URL caps them at about 200 IDs per call. The SDK raises a validation error past 8,000 URL characters instead of letting the gateway answer HTTP 414.

## Bulk and P2P: partial success is not an error

A bulk or P2P call resolves normally even when some items are rejected. Each item's `status` is
either a message status (1000 to 1999) or an error code (2000 and up). Two guards tell them apart:

```ts
import { isWebServiceResponseCode } from "@adsefid/sdk";

for (const item of result.receptors) {
  if (isWebServiceResponseCode(item.status)) {
    console.log(item.receptor, "rejected with code", item.status);
  } else {
    console.log(item.receptor, "accepted as", item.message_id);
  }
}
```

Item values reach the API unchanged, so valid items still go out. If every item is rejected, the
call rejects with an `AdsefidApiError` whose `details.items` lists each rejected index. Only
request-level fields are checked locally.

## Template parameters

A parameter the template declares as `number` can be sent as a number or a string. The service
substitutes a numeric string as written, so a string is the only way to keep exact digits:

```ts
await client.sms.sendTemplate({
  template_id: "invoice_notice",
  parameters: {
    invoice: "001234", // renders 001234, not 1234
    amount: "1.50",    // renders 1.50, not 1.5
    count: 2,
    rate: 19.99,       // a double, so rounding is possible
  },
  receptor: "09120000000",
  line_number: "983000",
  line_selector: LineSelector.BulkServiceSendBased,
});
```

## File upload

```ts
import { readFile } from "node:fs/promises";

const { file_id } = await client.messenger.uploadFile({
  file: await readFile("./brochure.pdf"),
  filename: "brochure.pdf",
  contentType: "application/pdf",
});

await client.messenger.sendSingle({
  message: "Here's our brochure",
  receptor: "989120000000",
  profile: "b72ea7f4-44b4-4f5e-91ef-91816ae5f88a",
  file_id,
});
```

`file` can be a `Uint8Array` (so a Node.js `Buffer`), a `Blob`, an `ArrayBuffer` or a
`ReadableStream<Uint8Array>`. `contentType` is required. Content is limited to 15 MiB inclusive
(`MESSENGER_MAX_FILE_SIZE_BYTES`). A larger file throws `AdsefidValidationError` before any request
is sent. The service also enforces a MIME allowlist and answers `FILE_TOO_LARGE` (2047) if it
still objects to the size.

## Errors

Every method throws on failure. All errors extend `AdsefidError`.

| Error | Meaning |
|---|---|
| `AdsefidValidationError` | A local check failed. No request was sent. Has `field`. |
| `AdsefidApiError` | The API returned an error envelope, or a non-2xx status without one. Has `code`, `codeName`, `httpStatusCode` and optional `details`. |
| `AdsefidRateLimitError` | Extends `AdsefidApiError`. Codes 2035 and 2036, or any HTTP 429. |
| `AdsefidTransportError` | Network failure, timeout, abort, or a response body that could not be parsed. |
| `AdsefidWebhookVerificationError` | A webhook failed verification. |

```ts
import { AdsefidApiError, AdsefidRateLimitError, AdsefidTransportError, WebServiceResponseCode } from "@adsefid/sdk";

try {
  await client.sms.sendSingle({ receptor: "989120000000", line_number: "983000", line_selector: LineSelector.BulkServiceSendBased, message: "hi" });
} catch (err) {
  if (err instanceof AdsefidRateLimitError) {
    console.warn("rate limited:", err.codeName);
  } else if (err instanceof AdsefidApiError) {
    console.error(err.code, err.codeName, err.httpStatusCode, err.details);
    if (err.code === WebServiceResponseCode.DUPLICATE_LOCAL_ID) {
      // the message was already accepted earlier
    }
  } else if (err instanceof AdsefidTransportError) {
    console.error("transport failure:", err.message, err.cause);
  } else {
    throw err;
  }
}
```

The symbolic name is `err.codeName`, because `err.name` stays the class name. A non-2xx response
with no error envelope has code `-1` and `codeName` `UNKNOWN_ERROR`; a bare 429 has code 2036 and
`RATE_LIMITED`. `details.errors` maps field names (or rejected cancel IDs) to `{ code, name }`, and
`details.items` carries indexed bulk/P2P errors. The SDK sends each request once and never
retries. Wrap `fetchImpl` if you want backoff.

## Enums and unknown values

`LineSelector`, `WebServiceMessageStatus`, `WebServiceResponseCode`, `TemplateState` and
`TemplateParameterType` are exported as constant objects with matching union types. A value the
service adds later is kept as the raw number or string instead of failing, so numeric codes and
`TemplateState` accept values the constants do not list yet.

## Webhooks

`verifyAndParseWebhook` checks the signature and timestamp, then returns a typed event. It is
async because it uses Web Crypto. Give it the exact raw request bytes. A body that a framework
already parsed will not verify.

```ts
import { createServer } from "node:http";
import {
  verifyAndParseWebhook,
  AdsefidWebhookVerificationError,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_HEADERS_LOWERCASE,
} from "@adsefid/sdk";

createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    let event;
    try {
      event = await verifyAndParseWebhook({
        rawBody: Buffer.concat(chunks),
        signatureHeader: String(req.headers[WEBHOOK_HEADERS_LOWERCASE.signature] ?? ""),
        timestampHeader: String(req.headers[WEBHOOK_HEADERS_LOWERCASE.timestamp] ?? ""),
        secret: process.env.ADSEFID_WEBHOOK_SECRET!,
      });
    } catch (err) {
      if (err instanceof AdsefidWebhookVerificationError) {
        res.writeHead(401).end(); // do not say why
        return;
      }
      throw err;
    }

    switch (event.type) {
      case WEBHOOK_EVENT_TYPES.receive:
        for (const m of event.data) console.log("SMS from", m.sender, m.message);
        break;
      case WEBHOOK_EVENT_TYPES.status:
      case WEBHOOK_EVENT_TYPES.messengerStatus:
        for (const s of event.data) console.log("status", s.id, s.status_delivery);
        break;
    }
    res.writeHead(200).end();
  });
}).listen(3000);
```

The panel shows the signing secret Base64-encoded, and the service signs with the decoded bytes.
Pass the secret exactly as shown, or pass the decoded key as a `Uint8Array`. An empty secret or key
is always rejected. A stale timestamp (default 300 seconds, change it with `maxAgeSeconds`) or a bad
signature throws `AdsefidWebhookVerificationError`.

In a `fetch(request)` handler on Bun, Deno or Workers, use
`new Uint8Array(await request.arrayBuffer())` as `rawBody` and `request.headers.get(...)` for the
headers. `examples/fetch-webhook-server.ts` is a complete receiver. Each endpoint only receives the
event types you subscribed it to in the panel. Deliveries can repeat, so make your handler
idempotent and return a 2xx quickly.

## Using this SDK with coding agents

[AGENTS.md](AGENTS.md) holds the repository rules. These points prevent most wrong guesses:

- Pass the API key and webhook secret explicitly. The SDK reads no environment variables.
- Treat a bulk or P2P response as data, not an error. Check each item's `status`.
- Send exact numeric text (`"001234"`, `"1.50"`) as strings.
- Give `verifyAndParseWebhook` raw bytes, never `JSON.stringify` of a parsed body.
- There are no retries and no automatic batching. Split large requests yourself.
- Use `instanceof AdsefidRateLimitError` before `AdsefidApiError`, and branch on `err.code`.

## Examples and contributing

Runnable samples are in [`examples/`](./examples): `account`, `quickstart`, `bulk-and-p2p`,
`templates`, `status-and-cancel`, `messenger`, `webhook-server` and `fetch-webhook-server`.
`account.ts` sends nothing, so try it first.

```bash
export ADSEFID_API_KEY=...
export ADSEFID_LINE_NUMBER=983000
npx tsx examples/quickstart.ts
```

To work on the SDK: `make deps`, then `make lint`, `make test` and `make build`. The test suite
also runs under Bun and Deno (`make runtimes`). See [AGENTS.md](AGENTS.md).

## Versioning and license

Semantic Versioning, independent of the API documentation. SDK version **1.0.0**, verified
against API documentation **v1.14.0**. Releases use `v<version>` tags. See
[CHANGELOG.md](CHANGELOG.md). MIT licensed, see [LICENSE](LICENSE).
