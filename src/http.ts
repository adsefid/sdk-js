import type { ResolvedAdsefidClientOptions } from "./config.js";
import { WebServiceResponseCode } from "./enums.js";
import {
  AdsefidApiError,
  AdsefidRateLimitError,
  AdsefidTransportError,
  AdsefidValidationError,
} from "./errors.js";
import type { ErrorEnvelope, SuccessEnvelope } from "./models/common.js";

export type HttpMethod = "GET" | "POST" | "QUERY";

/** Per-call options accepted as the last argument of every resource method. */
export interface CallOptions {
  /** Aborts this call. The client-wide `timeoutMs` still applies on top of it. */
  signal?: AbortSignal;
}

export interface RequestOptions {
  method: HttpMethod;
  path: string;
  /** A string is escaped as one value; an array is escaped per item, deduplicated, and joined with a literal comma. */
  query?: Record<string, string | readonly string[] | undefined>;
  jsonBody?: unknown;
  formBody?: FormData;
  /** Shape of the success `data` payload; defaults to a JSON object. */
  expect?: "object" | "array";
}

const UNKNOWN_ERROR_CODE = -1;

/**
 * Longest path-and-query the SDK sends. The service sits behind a proxy that rejects request
 * lines over 8 KiB with an HTML 414, so a GET with a very long ID list is refused locally.
 */
export const MAX_REQUEST_TARGET_LENGTH = 8000;

const RATE_LIMIT_CODES: readonly number[] = [
  WebServiceResponseCode.MESSAGE_LIMIT_REACHED,
  WebServiceResponseCode.REQUEST_LIMIT_REACHED,
];

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | readonly string[] | undefined>,
): string {
  const pairs: string[] = [];
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      const encoded =
        typeof value === "string"
          ? encodeURIComponent(value)
          : [...new Set(value)].map(encodeURIComponent).join(",");
      if (encoded !== "") {
        pairs.push(`${key}=${encoded}`);
      }
    }
  }
  const url = new URL(baseUrl + path + (pairs.length > 0 ? `?${pairs.join("&")}` : ""));
  const target = url.pathname + url.search;
  if (target.length > MAX_REQUEST_TARGET_LENGTH) {
    throw new AdsefidValidationError(
      `The request URL is ${target.length} characters long, over the ${MAX_REQUEST_TARGET_LENGTH} the service accepts; send fewer IDs per call.`,
    );
  }
  return url.toString();
}

export async function sendRequest<TData>(
  config: ResolvedAdsefidClientOptions,
  options: RequestOptions,
  callOptions?: CallOptions,
): Promise<TData> {
  const url = buildUrl(config.baseUrl, options.path, options.query);
  const headers: Record<string, string> = {
    "X-API-KEY": config.apiKey,
    "User-Agent": config.userAgent,
  };

  let body: FormData | string | undefined;
  if (options.formBody) {
    body = options.formBody;
  } else if (options.jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.jsonBody);
  }

  const callerSignal = callOptions?.signal;
  if (callerSignal?.aborted) {
    throw new AdsefidTransportError(
      `Request to ${options.path} was aborted by the caller`,
      callerSignal.reason,
    );
  }
  const controller = new AbortController();
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  const requestInit: RequestInit = {
    method: options.method,
    headers,
    signal: callerSignal ? AbortSignal.any([controller.signal, callerSignal]) : controller.signal,
  };
  if (body !== undefined) {
    requestInit.body = body;
  }

  const failure = (what: string, err: unknown, status?: number): AdsefidTransportError => {
    if (callerSignal?.aborted) {
      return new AdsefidTransportError(`${what} was aborted by the caller`, err);
    }
    if (timedOut) {
      return new AdsefidTransportError(`${what} timed out after ${config.timeoutMs}ms`, err);
    }
    return new AdsefidTransportError(
      status === undefined
        ? `Network request to ${options.path} failed: ${(err as Error).message}`
        : `Failed to read response body from ${options.path} (HTTP ${status})`,
      err,
    );
  };

  // Called detached: invoking it as `config.fetchImpl(...)` would bind `this` to the config
  // object, which runtimes with a strict `fetch` receiver reject as an illegal invocation.
  const { fetchImpl } = config;
  let response: Response;
  let rawText: string;
  try {
    try {
      response = await fetchImpl(url, requestInit);
    } catch (err) {
      throw failure(`Request to ${options.path}`, err);
    }

    // The timeout stays armed while the body streams in, so a stalled body is bounded too.
    try {
      rawText = await response.text();
    } catch (err) {
      throw failure(`Response body from ${options.path}`, err, response.status);
    }
  } finally {
    clearTimeout(timeoutHandle);
  }

  let parsed: unknown;
  try {
    parsed = rawText.length > 0 ? JSON.parse(rawText) : undefined;
  } catch (err) {
    // A proxy's HTML error page is still an HTTP failure, not a broken transport.
    if (response.ok) {
      throw new AdsefidTransportError(
        `Failed to parse response body from ${options.path} as JSON (HTTP ${response.status})`,
        err,
      );
    }
    parsed = undefined;
  }

  if (isErrorEnvelope(parsed)) {
    const { code, name, details } = parsed.error;
    const errorParams = {
      message: `${name} (code ${code}) from ${options.path}`,
      code,
      codeName: name,
      httpStatusCode: response.status,
      details,
    };
    if (RATE_LIMIT_CODES.includes(code) || response.status === 429) {
      throw new AdsefidRateLimitError(errorParams);
    }
    throw new AdsefidApiError(errorParams);
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new AdsefidRateLimitError({
        message: `HTTP 429 from ${options.path} without a valid error envelope`,
        code: WebServiceResponseCode.REQUEST_LIMIT_REACHED,
        codeName: "RATE_LIMITED",
        httpStatusCode: response.status,
      });
    }
    throw new AdsefidApiError({
      message: `HTTP ${response.status} from ${options.path} without a valid error envelope`,
      code: UNKNOWN_ERROR_CODE,
      codeName: "UNKNOWN_ERROR",
      httpStatusCode: response.status,
    });
  }

  if (!isSuccessEnvelope(parsed, options.expect ?? "object")) {
    throw new AdsefidTransportError(
      `Unexpected response shape from ${options.path} (HTTP ${response.status})`,
    );
  }

  return parsed.data as TData;
}

function isSuccessEnvelope(
  value: unknown,
  expect: "object" | "array",
): value is SuccessEnvelope<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.status !== "success") {
    return false;
  }
  return expect === "array"
    ? Array.isArray(record.data)
    : typeof record.data === "object" && record.data !== null && !Array.isArray(record.data);
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.status !== "error" || typeof record.error !== "object" || record.error === null) {
    return false;
  }
  const error = record.error as Record<string, unknown>;
  return (
    typeof error.code === "number" && Number.isInteger(error.code) && typeof error.name === "string"
  );
}
