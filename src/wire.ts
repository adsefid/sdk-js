import { AdsefidError, AdsefidTransportError } from "./errors.js";

/**
 * Runs the mapping that turns a decoded response body into the public model. Anything other than
 * an SDK error (a missing array, a wrong type) means the body had an unexpected shape, which
 * surfaces as an `AdsefidTransportError` rather than a bare `TypeError`.
 */
export function mapResponse<T>(path: string, map: () => T): T {
  try {
    return map();
  } catch (err) {
    if (err instanceof AdsefidError) {
      throw err;
    }
    throw new AdsefidTransportError(`Unexpected response shape from ${path}`, err);
  }
}
