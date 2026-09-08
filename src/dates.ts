import {
  AdsefidTransportError,
  AdsefidValidationError,
  type AdsefidWebhookVerificationError,
} from "./errors.js";

export type Wire<T> = T extends Date
  ? string
  : T extends readonly (infer TItem)[]
    ? Wire<TItem>[]
    : T extends object
      ? { [TKey in keyof T]: Wire<T[TKey]> }
      : T;

type DateParseError = typeof AdsefidTransportError | typeof AdsefidWebhookVerificationError;

export function dateToWire(value: Date | undefined, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new AdsefidValidationError(`'${field}' must be a valid Date.`, field);
  }
  return value.toISOString();
}

export function dateFromWire(
  value: unknown,
  field: string,
  ErrorType: DateParseError = AdsefidTransportError,
): Date {
  if (typeof value !== "string") {
    throw new ErrorType(`'${field}' must be an ISO-8601 datetime string.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new ErrorType(`'${field}' is not a valid ISO-8601 datetime.`);
  }
  return date;
}

export function nullableDateFromWire(
  value: unknown,
  field: string,
  ErrorType: DateParseError = AdsefidTransportError,
): Date | null {
  return value === null ? null : dateFromWire(value, field, ErrorType);
}
