import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AdsefidWebhookVerificationError } from "../src/errors.js";
import {
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_HEADERS,
  WEBHOOK_HEADERS_LOWERCASE,
} from "../src/webhooks/headers.js";
import { verifyAndParseWebhook } from "../src/webhooks/verify.js";
import { fixtureBytes, fixtureJson } from "./helpers/fixtures.js";
import { nowTimestamp, sign } from "./helpers/webhookSign.js";

interface SignatureVector {
  secret: string;
  timestamp: string;
  body_file: string;
  signature: string;
  tampered_signature: string;
}

const VECTOR = fixtureJson<SignatureVector>("webhooks/signature_vector.json");
const GOLDEN_BODY = fixtureBytes(VECTOR.body_file);
const A_CENTURY = 100 * 365 * 24 * 60 * 60;

describe("the golden vector", () => {
  /**
   * The cross-SDK vector. It proves the HMAC key is the Base64-DECODED secret
   * bytes rather than the UTF-8 bytes of the Base64 string the panel shows.
   * Its timestamp is fixed, so the staleness window has to be opened wide.
   */
  it("verifies and parses", () => {
    const event = verifyAndParseWebhook({
      rawBody: GOLDEN_BODY,
      signatureHeader: VECTOR.signature,
      timestampHeader: VECTOR.timestamp,
      secret: VECTOR.secret,
      maxAgeSeconds: A_CENTURY,
    });

    expect(event.type).toBe("receive");
    expect(event.attempt).toBe(1);
    expect(event.version).toBe("1");
    expect(event.id).toBeTruthy();
    if (event.type !== "receive") {
      throw new Error("expected a receive event");
    }
    expect(event.data).toHaveLength(1);
    expect(event.data[0]?.sender).toBeTruthy();
  });

  it("rejects a signature keyed with the UTF-8 bytes of the Base64 secret", () => {
    // Regression guard: this is what the SDK used to compute, and it never
    // matched a real delivery.
    const wrong = `v1=${createHmac("sha256", VECTOR.secret)
      .update(Buffer.from(`${VECTOR.timestamp}.`, "utf8"))
      .update(GOLDEN_BODY)
      .digest("base64")}`;

    expect(wrong).not.toBe(VECTOR.signature);
    expect(() =>
      verifyAndParseWebhook({
        rawBody: GOLDEN_BODY,
        signatureHeader: wrong,
        timestampHeader: VECTOR.timestamp,
        secret: VECTOR.secret,
        maxAgeSeconds: A_CENTURY,
      }),
    ).toThrow(AdsefidWebhookVerificationError);
  });

  it("accepts the decoded key as a Uint8Array", () => {
    const key = new Uint8Array(Buffer.from(VECTOR.secret, "base64"));

    const event = verifyAndParseWebhook({
      rawBody: GOLDEN_BODY,
      signatureHeader: VECTOR.signature,
      timestampHeader: VECTOR.timestamp,
      secret: key,
      maxAgeSeconds: A_CENTURY,
    });

    expect(event.type).toBe("receive");
  });

  it("accepts a string body as well as a Buffer", () => {
    const event = verifyAndParseWebhook({
      rawBody: GOLDEN_BODY.toString("utf8"),
      signatureHeader: VECTOR.signature,
      timestampHeader: VECTOR.timestamp,
      secret: VECTOR.secret,
      maxAgeSeconds: A_CENTURY,
    });

    expect(event.type).toBe("receive");
  });
});

describe("each event type parses to its own shape", () => {
  const cases = [
    ["receive", "webhooks/receive.body.json"],
    ["status", "webhooks/status.body.json"],
    ["messenger.status", "webhooks/messenger_status.body.json"],
  ] as const;

  it.each(cases)("parses %s", (expectedType, fixture) => {
    const body = fixtureBytes(fixture);
    const timestamp = nowTimestamp();

    const event = verifyAndParseWebhook({
      rawBody: body,
      signatureHeader: sign(VECTOR.secret, timestamp, body),
      timestampHeader: timestamp,
      secret: VECTOR.secret,
    });

    expect(event.type).toBe(expectedType);
    expect(event.data.length).toBeGreaterThan(0);
  });

  it("types a status delivery code", () => {
    const body = fixtureBytes("webhooks/status.body.json");
    const timestamp = nowTimestamp();

    const event = verifyAndParseWebhook({
      rawBody: body,
      signatureHeader: sign(VECTOR.secret, timestamp, body),
      timestampHeader: timestamp,
      secret: VECTOR.secret,
    });

    if (event.type !== "status") {
      throw new Error("expected a status event");
    }
    expect(event.data[0]?.status_delivery).toBe(1002);
    expect(event.data[0]?.local_id).toBe("order-10001");
  });
});

describe("rejections", () => {
  function freshlySigned() {
    const timestamp = nowTimestamp();
    return { timestamp, signature: sign(VECTOR.secret, timestamp, GOLDEN_BODY) };
  }

  // Assert the error type only, never the message: a doubly-invalid request may
  // report either failure depending on the order the checks run in.
  const cases: Array<[string, () => unknown]> = [
    [
      "a tampered signature",
      () =>
        verifyAndParseWebhook({
          rawBody: GOLDEN_BODY,
          signatureHeader: VECTOR.tampered_signature,
          timestampHeader: VECTOR.timestamp,
          secret: VECTOR.secret,
          maxAgeSeconds: A_CENTURY,
        }),
    ],
    [
      "a tampered body",
      () => {
        const { timestamp, signature } = freshlySigned();
        return verifyAndParseWebhook({
          rawBody: Buffer.concat([GOLDEN_BODY, Buffer.from(" ")]),
          signatureHeader: signature,
          timestampHeader: timestamp,
          secret: VECTOR.secret,
        });
      },
    ],
    [
      "a missing v1= prefix",
      () => {
        const { timestamp, signature } = freshlySigned();
        return verifyAndParseWebhook({
          rawBody: GOLDEN_BODY,
          signatureHeader: signature.slice("v1=".length),
          timestampHeader: timestamp,
          secret: VECTOR.secret,
        });
      },
    ],
    [
      "a wrong secret",
      () => {
        const { timestamp, signature } = freshlySigned();
        return verifyAndParseWebhook({
          rawBody: GOLDEN_BODY,
          signatureHeader: signature,
          timestampHeader: timestamp,
          secret: Buffer.from("a-completely-different-32-byte!!!").toString("base64"),
        });
      },
    ],
    [
      "a secret that is not Base64",
      () => {
        const { timestamp, signature } = freshlySigned();
        return verifyAndParseWebhook({
          rawBody: GOLDEN_BODY,
          signatureHeader: signature,
          timestampHeader: timestamp,
          secret: "not base64 !!",
        });
      },
    ],
    [
      "a non-numeric timestamp",
      () => {
        const { signature } = freshlySigned();
        return verifyAndParseWebhook({
          rawBody: GOLDEN_BODY,
          signatureHeader: signature,
          timestampHeader: "not-a-number",
          secret: VECTOR.secret,
        });
      },
    ],
    [
      "an empty timestamp",
      () => {
        const { signature } = freshlySigned();
        return verifyAndParseWebhook({
          rawBody: GOLDEN_BODY,
          signatureHeader: signature,
          timestampHeader: "",
          secret: VECTOR.secret,
        });
      },
    ],
  ];

  it.each(cases)("rejects %s", (_name, call) => {
    expect(call).toThrow(AdsefidWebhookVerificationError);
  });

  it.each([
    ["stale", -301],
    ["in the future", 301],
  ])("rejects a timestamp %s", (_name, offset) => {
    const timestamp = nowTimestamp(offset);

    expect(() =>
      verifyAndParseWebhook({
        rawBody: GOLDEN_BODY,
        signatureHeader: sign(VECTOR.secret, timestamp, GOLDEN_BODY),
        timestampHeader: timestamp,
        secret: VECTOR.secret,
      }),
    ).toThrow(/stale/);
  });

  it("honours a widened maxAgeSeconds", () => {
    const timestamp = nowTimestamp(-600);
    const signature = sign(VECTOR.secret, timestamp, GOLDEN_BODY);
    const params = {
      rawBody: GOLDEN_BODY,
      signatureHeader: signature,
      timestampHeader: timestamp,
      secret: VECTOR.secret,
    };

    expect(() => verifyAndParseWebhook(params)).toThrow(AdsefidWebhookVerificationError);
    expect(verifyAndParseWebhook({ ...params, maxAgeSeconds: 900 }).type).toBe("receive");
  });

  it("checks the signature before freshness", () => {
    // All five SDKs report the signature first for a doubly-invalid request.
    expect(() =>
      verifyAndParseWebhook({
        rawBody: GOLDEN_BODY,
        signatureHeader: VECTOR.tampered_signature,
        timestampHeader: nowTimestamp(-600),
        secret: VECTOR.secret,
      }),
    ).toThrow(/signature/);
  });

  it.each([
    ["an unknown event type", fixtureBytes("webhooks/unknown_type.body.json")],
    ["a body that is not JSON", Buffer.from("<html>nope</html>")],
    ["JSON that is not an object", Buffer.from("[1,2,3]")],
    ["a payload missing required fields", Buffer.from('{"type":"receive"}')],
  ])("rejects %s", (_name, body) => {
    const timestamp = nowTimestamp();

    expect(() =>
      verifyAndParseWebhook({
        rawBody: body,
        signatureHeader: sign(VECTOR.secret, timestamp, body),
        timestampHeader: timestamp,
        secret: VECTOR.secret,
      }),
    ).toThrow(AdsefidWebhookVerificationError);
  });
});

describe("header and event constants", () => {
  it("carries the literal wire header names", () => {
    // Renaming any of these breaks every deployed receiver.
    expect(WEBHOOK_HEADERS.id).toBe("X-Atlas-Webhook-Id");
    expect(WEBHOOK_HEADERS.signature).toBe("X-Atlas-Webhook-Signature");
    expect(WEBHOOK_HEADERS.timestamp).toBe("X-Atlas-Webhook-Timestamp");
    expect(WEBHOOK_HEADERS.event).toBe("X-Atlas-Webhook-Event");
    expect(WEBHOOK_HEADERS.attempt).toBe("X-Atlas-Webhook-Attempt");
  });

  it("offers lowercase names for node:http, which lowercases incoming headers", () => {
    for (const key of Object.keys(WEBHOOK_HEADERS) as Array<keyof typeof WEBHOOK_HEADERS>) {
      expect(WEBHOOK_HEADERS_LOWERCASE[key]).toBe(WEBHOOK_HEADERS[key].toLowerCase());
    }
  });

  it("carries the documented event type values", () => {
    expect(WEBHOOK_EVENT_TYPES.receive).toBe("receive");
    expect(WEBHOOK_EVENT_TYPES.status).toBe("status");
    expect(WEBHOOK_EVENT_TYPES.messengerStatus).toBe("messenger.status");
  });
});
