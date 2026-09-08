import { describe, expect, it } from "vitest";
import { AdsefidClient } from "../src/client.js";
import {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  resolveClientOptions,
} from "../src/config.js";
import { AdsefidTransportError, AdsefidValidationError } from "../src/errors.js";
import { fetchStub, TEST_API_KEY, TEST_BASE_URL } from "./helpers/fetchStub.js";
import { fixtureText } from "./helpers/fixtures.js";

describe("resolveClientOptions", () => {
  it("fills in the documented defaults", () => {
    const resolved = resolveClientOptions({ apiKey: "k" });

    expect(resolved.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(resolved.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(resolved.userAgent).toBe(DEFAULT_USER_AGENT);
  });

  it("prefixes the default user agent rather than pinning a version", () => {
    // The version is injected at build time, so never assert it exactly.
    expect(DEFAULT_USER_AGENT).toMatch(/^adsefid-js\//);
  });

  it("strips trailing slashes from the base URL", () => {
    expect(resolveClientOptions({ apiKey: "k", baseUrl: "https://api.test///" }).baseUrl).toBe(
      "https://api.test",
    );
  });

  it.each(["", "   ", "bad\nagent", "bad\ragent"])(
    "rejects the unusable user agent %j",
    (userAgent) => {
      expect(() => resolveClientOptions({ apiKey: "k", userAgent })).toThrow(
        AdsefidValidationError,
      );
    },
  );

  it("keeps a supplied fetch implementation", () => {
    const stub = fetchStub();
    expect(resolveClientOptions({ apiKey: "k", fetchImpl: stub.fetchImpl }).fetchImpl).toBe(
      stub.fetchImpl,
    );
  });
});

describe("AdsefidClient", () => {
  it("wires up all three resources", () => {
    const client = new AdsefidClient({ apiKey: "k" });

    expect(client.sms).toBeDefined();
    expect(client.messenger).toBeDefined();
    expect(client.user).toBeDefined();
  });

  it("sends the api key and a custom user agent on every request", async () => {
    const stub = fetchStub({ body: fixtureText("envelopes/user.get_info.success.json") });
    const client = new AdsefidClient({
      apiKey: TEST_API_KEY,
      baseUrl: TEST_BASE_URL,
      fetchImpl: stub.fetchImpl,
      userAgent: "my-app/2.1",
    });

    await client.user.getInfo();

    const call = stub.only();
    expect(call.headers["X-API-KEY"]).toBe(TEST_API_KEY);
    expect(call.headers["User-Agent"]).toBe("my-app/2.1");
  });

  it("aborts a request that outlives timeoutMs", async () => {
    // The SDK arms an AbortController per request; a fetch that only settles
    // when the signal fires proves the wiring, without any real waiting.
    const client = new AdsefidClient({
      apiKey: "k",
      baseUrl: TEST_BASE_URL,
      timeoutMs: 5,
      fetchImpl: ((_input: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })) as typeof fetch,
    });

    await expect(client.user.getInfo()).rejects.toBeInstanceOf(AdsefidTransportError);
  });
});
