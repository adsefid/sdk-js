import { AdsefidValidationError } from "./errors.js";

declare const __ADSEFID_SDK_VERSION__: string;

/** Options accepted by `new AdsefidClient(...)`. */
export interface AdsefidClientOptions {
  /** Secret API key, sent as the `X-API-KEY` header on every request. */
  apiKey: string;
  /** Default `"https://api.adsefid.com"`. */
  baseUrl?: string;
  /** Override the `fetch` implementation used for all HTTP calls (e.g. for testing). */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in milliseconds. Default `30000`. */
  timeoutMs?: number;
  /** Value sent in the `User-Agent` header. Defaults to `adsefid-js/<SDK_VERSION>`. */
  userAgent?: string;
}

export const DEFAULT_BASE_URL = "https://api.adsefid.com";
export const DEFAULT_TIMEOUT_MS = 30_000;
const SDK_VERSION =
  typeof __ADSEFID_SDK_VERSION__ === "undefined" ? "0+unknown" : __ADSEFID_SDK_VERSION__;
export const DEFAULT_USER_AGENT = `adsefid-js/${SDK_VERSION}`;

export interface ResolvedAdsefidClientOptions {
  apiKey: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  userAgent: string;
}

export function resolveClientOptions(options: AdsefidClientOptions): ResolvedAdsefidClientOptions {
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  if (userAgent.trim() === "" || /[\r\n]/u.test(userAgent)) {
    throw new AdsefidValidationError(
      "userAgent must be non-blank and contain no line breaks",
      "userAgent",
    );
  }

  return {
    apiKey: options.apiKey,
    baseUrl: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent,
  };
}
