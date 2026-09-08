# AGENTS.md — @adsefid/sdk

## Scope

This repository is the JavaScript/TypeScript client SDK for the adsefid.com SMS Web Service API
(package: `@adsefid/sdk`), standalone and independently versioned and published with its own
`package.json`. Equivalent SDKs exist for the same API in sibling repositories (`sdk-dotnet`,
`sdk-php`, `sdk-python`, `sdk-go`); a behavior change here should generally be considered for
parity there.

## Source of truth

The API surface (endpoints, field names, types, validation rules, enums, example payloads,
webhook behavior) is defined by the published adsefid.com SMS Web Service API documentation.
This SDK is verified against doc version v1.12.0 (release date 2026-09-08). Before changing any
endpoint, request/response model, or enum, re-read the relevant documentation. The SDK follows
independent Semantic Versioning from `package.json`; never copy the API-document version into
package metadata. Record both versions in the README.

A small number of facts below are empirically observed behaviors of the live API that are easy
to get wrong from a literal reading of the documentation's prose or pseudo-code. Trust these
notes over an ambiguous doc reading:

- Webhook signatures are plain Base64, not hex-then-Base64. The signature is HMAC-SHA256 over
  the literal string "{timestamp}.{raw_body}", and the raw digest bytes are Base64-encoded
  directly — there is no intermediate hex-encoding step, even though a literal reading of some
  spec pseudo-code can suggest one. See `src/webhooks/verify.ts`.
- `TemplateParameterType` has an undocumented third value in the wild. The documented, supported
  public set is {string, number}. The live API has been observed to also emit a `url` value for
  some templates; this SDK intentionally models only the two documented values — do not add
  support for it without first confirming it against current, documented API behavior. See
  `src/enums.ts`.
- `error.details` shape varies per endpoint and is intentionally untyped (`unknown`). It may be
  a validation map, a bulk/P2P per-item list, a cancel-specific map, or absent entirely — never
  give it a strong type; decode it defensively per endpoint if you need it.

If you find another such mismatch, prefer the documented/observed live behavior over ambiguous
doc prose, and leave a comment explaining why the code doesn't match the doc text.

## Architecture map

```
src/
  index.ts                 barrel export — every public symbol comes from here
  client.ts                AdsefidClient: constructs config, owns .sms/.messenger/.user
  config.ts                AdsefidClientOptions type + resolveClientOptions() defaults
  http.ts                  sendRequest(): builds fetch call, applies timeout, parses envelope, throws typed errors
  multipart.ts             buildFileFormData(): Blob/ArrayBuffer/ReadableStream -> FormData with field "file"
  validation.ts            LOCAL_ID_PATTERN + assert* pre-flight checks + joinCsv()
  errors.ts                AdsefidError hierarchy
  enums.ts                 LineSelector, WebServiceMessageStatus, WebServiceResponseCode (+ HTTP status map),
                            TemplateState, TemplateParameterType, WebServiceStatus — all `as const` objects
  resources/sms.ts         SmsResource: sendSingle, sendBulk, sendP2P, sendTemplate, getStatus, cancel, getReceived
  resources/messenger.ts   MessengerResource: sendSingle, sendBulk, sendP2P, uploadFile, cancel, sendTemplate, getStatus
  resources/user.ts        UserResource: getInfo, getLines, getProfiles, getTemplates
  models/common.ts         ApiEnvelope, CancelRequest/Response, WebServiceCodeCounts, etc.
  models/sms.ts            request/response types for all 7 SMS operations
  models/messenger.ts      request/response types for all 7 Messenger operations
  models/user.ts           request/response types for all 4 User operations
  webhooks/verify.ts       verifyAndParseWebhook() — HMAC-SHA256 signature + timestamp check
  webhooks/events.ts       WebhookEvent union + ReceiveWebhookEvent/StatusWebhookEvent/MessengerStatusWebhookEvent
  webhooks/headers.ts      WEBHOOK_HEADERS/WEBHOOK_HEADERS_LOWERCASE/WEBHOOK_EVENT_TYPES constants — use instead of typing header/type strings
```

## Adding a new endpoint

1. Add the request/response types to the matching `models/sms.ts`, `models/messenger.ts`, or `models/user.ts`.
2. Add the method to the matching `resources/*.ts` class, following the existing pattern: client-side pre-flight validation first (via `validation.ts` helpers), then a single `sendRequest(...)` call.
3. If it's a new public type or a new resource method's option type, export it from `src/index.ts`.
4. If it introduces a new enum value or a new `WebServiceResponseCode`, add it to `enums.ts` — never inline the raw number/string at the call site.

## Hard rules

- **Every change ships with tests.** `tests/` runs on Vitest (`make test`), a devDependency only —
  the published package keeps its zero runtime dependencies. Endpoint tests are table-driven
  (`it.each`) rather than one function per case. `tsconfig.test.json` type-checks `tests/`
  separately, because `tsconfig.json` pins `rootDir: "src"` for the build.
- **Golden fixtures are shared across all five SDKs.** `tests/fixtures/` is byte-identical to the
  same tree in the sibling repositories. Never edit one in isolation: change it in all five and
  regenerate every `CHECKSUMS.txt`, or `tests/fixtures.test.ts` fails.
- **`__ADSEFID_SDK_VERSION__` is a build-time define.** tsup injects it, and `vitest.config.ts` has
  to define it too or the User-Agent falls back to `0+unknown`. Assert the `adsefid-js/` prefix in
  tests, never an exact version.
- **Zero runtime dependencies.** Think hard before adding one — native `fetch`, `FormData`, `Blob`, `ReadableStream`, and `node:crypto` have covered everything so far. `devDependencies` (`typescript`, `tsup`, `@types/node`) are fine.
- **No magic string/number literals.** A response code, message status, line selector, template state, or parameter type always comes from `enums.ts`. A validation limit (max length, max count, take range, etc.) is a named constant near its use, not an inline number.
- **No code comments except where a genuinely non-obvious constraint requires one** (e.g. why the webhook signature has no hex step or why `codeName` isn't called `name`).
- **Throw on error, always.** Every resource method throws `AdsefidError` subclasses on failure; never introduce a `Result`/`Either` return wrapper. Partial-success bulk/P2P responses are normal typed returns, not errors — that's an API design choice already baked into the response shape.
- **Datetimes use native `Date` objects.** Serialize request fields explicitly with
  `Date.toISOString()` and deserialize documented response/webhook fields explicitly. Never use a
  global key-based JSON reviver: template parameters and untyped error details can reuse those keys.
  Native `Date` preserves the instant but not the source UTC offset.
- **Template parameter values.** `TemplateParameterValue`/`TemplateParameters` live once in
  `models/common.ts`; `models/sms.ts` and `models/messenger.ts` both import from there. A `number`
  parameter may legitimately travel as a JSON *string* — that is how leading zeros (`"001234"`) and
  exact decimals (`"1.50"`) reach the service intact, since it substitutes a numeric string
  verbatim and JavaScript numbers are IEEE-754 doubles.
- **The webhook secret is Base64.** A webhook endpoint's secret is 32 random bytes shown
  Base64-encoded in the panel, and the service signs with the **decoded** bytes.
  `verifyAndParseWebhook` decodes before keying the HMAC, accepts a `Uint8Array` for a pre-decoded
  key, and hashes the raw body bytes rather than a re-encoded string. Keying the HMAC with the
  UTF-8 bytes of the Base64 string does not verify against the live service.
- **No retry logic anywhere in this SDK.** Every request is a single attempt.

## Build / typecheck

```bash
npm run build        # tsup -> dist/ (ESM + CJS + .d.ts/.d.cts)
npx tsc --noEmit      # strict typecheck, no emit
```

## Standalone repo

This directory is meant to become its own git repository with its own `package.json`, `node_modules`, and release cadence. It does not inherit or share tooling with any other repository's Node/TypeScript setup — don't assume a root-level `tsconfig.json`, lint config, or CI pipeline from elsewhere applies here.
