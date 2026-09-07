/**
 * Base class for every error thrown by this SDK.
 */
export class AdsefidError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "AdsefidError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by client-side pre-flight validation, before a request is sent.
 */
export class AdsefidValidationError extends AdsefidError {
  public readonly field: string | undefined;

  public constructor(message: string, field?: string) {
    super(message);
    this.name = "AdsefidValidationError";
    this.field = field;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API responds with `{"status":"error",...}` or a non-2xx
 * HTTP status. `codeName` intentionally does not use the property name
 * `name`, which would shadow `Error.prototype.name`.
 */
export class AdsefidApiError extends AdsefidError {
  public readonly code: number;
  public readonly codeName: string;
  public readonly httpStatusCode: number;
  public readonly details: unknown;

  public constructor(params: {
    message: string;
    code: number;
    codeName: string;
    httpStatusCode: number;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "AdsefidApiError";
    this.code = params.code;
    this.codeName = params.codeName;
    this.httpStatusCode = params.httpStatusCode;
    this.details = params.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown for MESSAGE_LIMIT_REACHED (2035) and REQUEST_LIMIT_REACHED (2036).
 */
export class AdsefidRateLimitError extends AdsefidApiError {
  public constructor(params: {
    message: string;
    code: number;
    codeName: string;
    httpStatusCode: number;
    details?: unknown;
  }) {
    super(params);
    this.name = "AdsefidRateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown for network failures, timeouts, and other transport-level problems
 * that never produced a parsed API response.
 */
export class AdsefidTransportError extends AdsefidError {
  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AdsefidTransportError";
    if (cause !== undefined) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown by `verifyAndParseWebhook` on a bad signature, a stale timestamp,
 * or a malformed payload.
 */
export class AdsefidWebhookVerificationError extends AdsefidError {
  public constructor(message: string) {
    super(message);
    this.name = "AdsefidWebhookVerificationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
