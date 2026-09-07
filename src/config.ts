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
}

export const DEFAULT_BASE_URL = "https://api.adsefid.com";
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface ResolvedAdsefidClientOptions {
  apiKey: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}

export function resolveClientOptions(options: AdsefidClientOptions): ResolvedAdsefidClientOptions {
  return {
    apiKey: options.apiKey,
    baseUrl: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}
