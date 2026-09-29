import type { ResolvedAdsefidClientOptions } from "./config.js";
import { WebServiceResponseCode } from "./enums.js";
import { AdsefidApiError, AdsefidRateLimitError, AdsefidTransportError } from "./errors.js";
import type { ErrorEnvelope, SuccessEnvelope } from "./models/common.js";

export type HttpMethod = "GET" | "POST";

export interface RequestOptions {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | undefined>;
  jsonBody?: unknown;
  formBody?: FormData;
}

const RATE_LIMIT_CODES: readonly number[] = [
  WebServiceResponseCode.MESSAGE_LIMIT_REACHED,
  WebServiceResponseCode.REQUEST_LIMIT_REACHED,
];

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | undefined>,
): string {
  const url = new URL(baseUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

export async function sendRequest<TData>(
  config: ResolvedAdsefidClientOptions,
  options: RequestOptions,
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

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), config.timeoutMs);

  const requestInit: RequestInit = {
    method: options.method,
    headers,
    signal: controller.signal,
  };
  if (body !== undefined) {
    requestInit.body = body;
  }

  // Called detached: invoking it as `config.fetchImpl(...)` would bind `this` to the config
  // object, which runtimes with a strict `fetch` receiver reject as an illegal invocation.
  const { fetchImpl } = config;
  let response: Response;
  let rawText: string;
  try {
    try {
      response = await fetchImpl(url, requestInit);
    } catch (err) {
      if (isAbort(err)) {
        throw new AdsefidTransportError(
          `Request to ${options.path} timed out after ${config.timeoutMs}ms`,
          err,
        );
      }
      throw new AdsefidTransportError(
        `Network request to ${options.path} failed: ${(err as Error).message}`,
        err,
      );
    }

    // The timeout stays armed while the body streams in, so a stalled body is bounded too.
    try {
      rawText = await response.text();
    } catch (err) {
      if (isAbort(err)) {
        throw new AdsefidTransportError(
          `Response body from ${options.path} timed out after ${config.timeoutMs}ms`,
          err,
        );
      }
      throw new AdsefidTransportError(
        `Failed to read response body from ${options.path} (HTTP ${response.status})`,
        err,
      );
    }
  } finally {
    clearTimeout(timeoutHandle);
  }

  let parsed: unknown;
  try {
    parsed = rawText.length > 0 ? JSON.parse(rawText) : undefined;
  } catch (err) {
    throw new AdsefidTransportError(
      `Failed to parse response body from ${options.path} as JSON (HTTP ${response.status})`,
      err,
    );
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
    const errorParams = {
      message: `HTTP ${response.status} from ${options.path} without a valid error envelope`,
      code: response.status,
      codeName: response.status === 429 ? "RATE_LIMITED" : `HTTP_${response.status}`,
      httpStatusCode: response.status,
    };
    if (response.status === 429) {
      throw new AdsefidRateLimitError(errorParams);
    }
    throw new AdsefidApiError(errorParams);
  }

  if (!isSuccessEnvelope(parsed)) {
    throw new AdsefidTransportError(
      `Unexpected response shape from ${options.path} (HTTP ${response.status})`,
    );
  }

  return parsed.data as TData;
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function isSuccessEnvelope(value: unknown): value is SuccessEnvelope<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.status === "success" && Object.hasOwn(record, "data") && record.data !== null;
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
