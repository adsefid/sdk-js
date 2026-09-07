import { AdsefidValidationError } from "./errors.js";

/**
 * Matches the `local_id` shape documented across every endpoint: 1-36 ASCII
 * letters/digits, with `- _ . :` allowed only strictly between the first and
 * last character.
 */
export const LOCAL_ID_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9\-_.:]{0,34}[A-Za-z0-9])?$/;

export function assertValidLocalId(localId: string | undefined, field = "local_id"): void {
  if (localId === undefined) {
    return;
  }
  if (!LOCAL_ID_PATTERN.test(localId)) {
    throw new AdsefidValidationError(
      `${field} must be 1-36 ASCII letters/digits, with "- _ . :" allowed only inside (not first/last character)`,
      field,
    );
  }
}

export function assertRequired(value: unknown, field: string): void {
  if (value === undefined || value === null || value === "") {
    throw new AdsefidValidationError(`${field} is required`, field);
  }
}

export function assertMaxLength(value: string, maxLength: number, field: string): void {
  if (value.length > maxLength) {
    throw new AdsefidValidationError(
      `${field} must be at most ${maxLength} characters (got ${value.length})`,
      field,
    );
  }
}

export function assertNonEmptyArray<T>(
  value: T[] | undefined,
  field: string,
): asserts value is T[] {
  if (!value || value.length === 0) {
    throw new AdsefidValidationError(`${field} must contain at least 1 item`, field);
  }
}

export function assertMaxCount(count: number, max: number, field: string): void {
  if (count > max) {
    throw new AdsefidValidationError(
      `${field} must contain at most ${max} items (got ${count})`,
      field,
    );
  }
}

export function assertInRange(value: number, min: number, max: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new AdsefidValidationError(
      `${field} must be an integer between ${min} and ${max} (got ${value})`,
      field,
    );
  }
}

export function assertAtLeastOneProvided(
  values: Array<{ name: string; value: unknown[] | undefined }>,
): void {
  const hasAny = values.some((v) => v.value !== undefined && v.value.length > 0);
  if (!hasAny) {
    const names = values.map((v) => v.name).join("/");
    throw new AdsefidValidationError(`At least one of ${names} is required`);
  }
}

/** Joins a CSV-style query param array (`message_ids`, `local_ids`, ...) into one string. */
export function joinCsv(values: string[] | undefined): string | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  return values.join(",");
}
