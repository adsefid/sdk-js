import type { AdsefidClientOptions, ResolvedAdsefidClientOptions } from "../../src/config.js";
import { resolveClientOptions } from "../../src/config.js";

// Derive the argument types from `fetch` itself rather than naming the DOM
// globals, which @types/node 18 (this SDK's floor) does not declare.
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | FormData | undefined;
  signal: AbortSignal | undefined;
}

export interface FetchStub {
  fetchImpl: typeof fetch;
  calls: RecordedCall[];
  /** The single recorded call; throws if there was not exactly one. */
  only(): RecordedCall;
}

function record(calls: RecordedCall[], input: FetchInput, init?: FetchInit): void {
  calls.push({
    url: String(input),
    method: init?.method ?? "GET",
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: init?.body as string | FormData | undefined,
    signal: init?.signal ?? undefined,
  });
}

/** A `fetch` stub that records every call and answers with a fixed response. */
export function fetchStub(response: { status?: number; body?: string | Buffer } = {}): FetchStub {
  const calls: RecordedCall[] = [];
  const stub: FetchStub = {
    fetchImpl: (input: FetchInput, init?: FetchInit) => {
      record(calls, input, init);
      const body = response.body ?? "{}";
      return Promise.resolve(
        new Response(typeof body === "string" ? body : new Uint8Array(body), {
          status: response.status ?? 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
    calls,
    only() {
      if (calls.length !== 1) {
        throw new Error(`expected exactly 1 request, got ${calls.length}`);
      }
      return calls[0] as RecordedCall;
    },
  };
  return stub;
}

/** A `fetch` stub that always rejects, for the transport-error paths. */
export function rejectingFetchStub(error: Error): FetchStub {
  const calls: RecordedCall[] = [];
  return {
    fetchImpl: (input: FetchInput, init?: FetchInit) => {
      record(calls, input, init);
      return Promise.reject(error);
    },
    calls,
    only() {
      return calls[0] as RecordedCall;
    },
  };
}

export const TEST_API_KEY = "test-api-key";
export const TEST_BASE_URL = "https://api.test";

export function testConfig(
  stub: FetchStub,
  overrides: Partial<AdsefidClientOptions> = {},
): ResolvedAdsefidClientOptions {
  return resolveClientOptions({
    apiKey: TEST_API_KEY,
    baseUrl: TEST_BASE_URL,
    fetchImpl: stub.fetchImpl,
    ...overrides,
  });
}

/** Parses a recorded JSON request body. */
export function bodyJson(call: RecordedCall): Record<string, unknown> {
  if (typeof call.body !== "string") {
    throw new Error("recorded request body is not a JSON string");
  }
  return JSON.parse(call.body) as Record<string, unknown>;
}

/** Parses the query string of a recorded call. */
export function queryOf(call: RecordedCall): URLSearchParams {
  return new URL(call.url).searchParams;
}
