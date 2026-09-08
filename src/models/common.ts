import type { WebServiceResponseCode, WebServiceStatus } from "../enums.js";

/**
 * A value bound to one named template parameter.
 *
 * The API accepts a JSON string or a JSON number for any parameter. For a
 * parameter the template declares as `number`, the service substitutes a
 * numeric *string* verbatim, so pass a string whenever the exact digits
 * matter: `"001234"` keeps its leading zeros and `"1.50"` its trailing zero,
 * where the numbers `1234` and `1.5` would not. JavaScript numbers are
 * IEEE-754 doubles, so a string is also the only exact representation of a
 * decimal the double type cannot hold.
 */
export type TemplateParameterValue = string | number;

/** The `parameters` map sent to, and echoed back by, the template endpoints. */
export type TemplateParameters = Record<string, TemplateParameterValue>;

/**
 * Successful API response envelope, per doc §2 "Response Envelope".
 */
export interface SuccessEnvelope<TData> {
  status: "success";
  data: TData;
}

/**
 * Error API response envelope, per doc §2 "Response Envelope".
 *
 * `details` is intentionally typed as `unknown`: its shape is
 * endpoint-specific (a validation map keyed by snake_case field path such as
 * `messages[0].local_id`, a bulk item list, a cancel-specific map, or
 * absent entirely).
 */
export interface ErrorEnvelope {
  status: "error";
  error: {
    code: WebServiceResponseCode | number;
    name: string;
    details?: unknown;
  };
}

export type ApiEnvelope<TData> = SuccessEnvelope<TData> | ErrorEnvelope;

/**
 * Counts keyed by `WebServiceCode` (message status or error code), per doc
 * §3.3. JSON object keys are always strings, even though the values they
 * represent are numeric codes.
 */
export type WebServiceCodeCounts = Record<string, number>;

export type { WebServiceStatus };

/** Shared shape of a single cancelled/failed-to-cancel entry (doc §4.6/§5.5). */
export interface CancelledMessage {
  message_id: string;
  local_id: string | null;
  status: WebServiceStatus;
}

/** Request body shared by `client.sms.cancel` and `client.messenger.cancel` — at least one of the two fields is required. */
export interface CancelRequest {
  message_ids?: string[];
  local_ids?: string[];
}

export interface CancelResponse {
  cancelled_messages: CancelledMessage[];
  failed_to_cancel: CancelledMessage[];
}

/** Shared shape of the `getStatus` query params (see `GetSmsStatusQuery`/`GetMessengerStatusQuery`): at least one of the two fields is required. */
export interface StatusQuery {
  message_ids?: string[];
  local_ids?: string[];
}
