// Smoke test for the BUILT package, run unchanged on Node.js, Bun, and Deno:
//
//   node tests/runtime/smoke.mjs
//   bun tests/runtime/smoke.mjs
//   deno run --allow-read --allow-net tests/runtime/smoke.mjs
//
// It imports the package by name, so the `exports` map in package.json is what resolves
// each entry point. Run `npm run build` first.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const runtime =
  typeof globalThis.Deno !== "undefined"
    ? `Deno ${globalThis.Deno.version.deno}`
    : typeof globalThis.Bun !== "undefined"
      ? `Bun ${globalThis.Bun.version}`
      : `Node.js ${process.versions.node}`;

const failures = [];

async function check(name, run) {
  try {
    await run();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}\n       ${error?.stack ?? error}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
const vector = JSON.parse(fixture("webhooks/signature_vector.json").toString("utf8"));
const goldenBody = new Uint8Array(fixture(vector.body_file));
const infoEnvelope = fixture("envelopes/user.get_info.success.json").toString("utf8");
const aCentury = 100 * 365 * 24 * 60 * 60;

console.log(`@adsefid/sdk smoke test on ${runtime}`);

const sdk = await import("@adsefid/sdk");

await check("the ESM entry resolves through the exports map", () => {
  assert(typeof sdk.AdsefidClient === "function", "no AdsefidClient export");
  assert(typeof sdk.verifyAndParseWebhook === "function", "no verifyAndParseWebhook export");
});

await check("the CommonJS entry resolves through the exports map", () => {
  const require = createRequire(import.meta.url);
  const cjs = require("@adsefid/sdk");
  assert(typeof cjs.AdsefidClient === "function", "no CJS AdsefidClient export");
  assert(typeof cjs.verifyAndParseWebhook === "function", "no CJS verifyAndParseWebhook export");
});

await check("the package exposes a single entry point", async () => {
  let resolved = true;
  try {
    await import("@adsefid/sdk/web");
  } catch {
    resolved = false;
  }
  assert(!resolved, "the retired @adsefid/sdk/web subpath still resolves");
});

const webhookParams = {
  rawBody: goldenBody,
  signatureHeader: vector.signature,
  timestampHeader: vector.timestamp,
  secret: vector.secret,
  maxAgeSeconds: aCentury,
};

await check("verifyAndParseWebhook accepts the golden vector", async () => {
  assert((await sdk.verifyAndParseWebhook(webhookParams)).type === "receive", "wrong type");
});

await check("verifyAndParseWebhook rejects a tampered signature", async () => {
  let rejected = false;
  try {
    await sdk.verifyAndParseWebhook({
      ...webhookParams,
      signatureHeader: vector.tampered_signature,
    });
  } catch (error) {
    rejected = error instanceof sdk.AdsefidWebhookVerificationError;
  }
  assert(rejected, "tampered signature was not rejected with AdsefidWebhookVerificationError");
});

await check("the client sends a request through a custom fetch", async () => {
  const seen = [];
  const client = new sdk.AdsefidClient({
    apiKey: "smoke-key",
    baseUrl: "https://api.test",
    fetchImpl: async (input, init) => {
      seen.push({ url: String(input), headers: init?.headers ?? {} });
      return new Response(infoEnvelope, { status: 200 });
    },
  });
  const info = await client.user.getInfo();
  assert(typeof info.credit_left === "number", "response was not parsed");
  assert(seen[0]?.url === "https://api.test/v1/user/info", `unexpected URL ${seen[0]?.url}`);
  assert(seen[0]?.headers["X-API-KEY"] === "smoke-key", "X-API-KEY header missing");
});

await check("file upload turns a stream or bytes into multipart form data", async () => {
  let form;
  const client = new sdk.AdsefidClient({
    apiKey: "smoke-key",
    baseUrl: "https://api.test",
    fetchImpl: async (_input, init) => {
      form = init?.body;
      return new Response(JSON.stringify({ status: "success", data: { file_id: "f" } }));
    },
  });
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([137, 80, 78, 71]));
      controller.close();
    },
  });
  const png = new Uint8Array([0, 137, 80, 78, 71, 0]).subarray(1, -1);
  for (const source of [stream, png]) {
    await client.messenger.uploadFile({
      file: source,
      filename: "a.png",
      contentType: "image/png",
    });
    const file = form?.get("file");
    assert(file instanceof Blob && file.size === 4, "uploaded part is missing or truncated");
    assert(file.type === "image/png", `unexpected part type ${file?.type}`);
  }
});

await check("the default fetch maps a network failure to AdsefidTransportError", async () => {
  const client = new sdk.AdsefidClient({ apiKey: "k", baseUrl: "http://127.0.0.1:9" });
  let mapped = false;
  try {
    await client.user.getInfo();
  } catch (error) {
    mapped = error instanceof sdk.AdsefidTransportError;
  }
  assert(mapped, "network failure was not an AdsefidTransportError");
});

if (failures.length > 0) {
  console.error(`${failures.length} smoke check(s) failed on ${runtime}`);
  process.exit(1);
}
console.log(`All smoke checks passed on ${runtime}`);
