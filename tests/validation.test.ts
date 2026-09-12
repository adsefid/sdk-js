import { describe, expect, it } from "vitest";
import {
  isWebServiceMessageStatus,
  isWebServiceResponseCode,
  WebServiceResponseCode,
  WebServiceResponseCodeHttpStatus,
} from "../src/enums.js";
import { AdsefidValidationError } from "../src/errors.js";
import {
  assertAtLeastOneProvided,
  assertInRange,
  assertMaxCount,
  assertMaxLength,
  assertNonEmptyArray,
  assertRequired,
  assertValidLocalId,
  joinCsv,
  LIMITS,
  LOCAL_ID_PATTERN,
} from "../src/validation.js";
import { fixtureJson } from "./helpers/fixtures.js";

interface LocalIdCase {
  value: string;
  valid: boolean;
  why: string;
}

interface Limits {
  sms_message_max_length: number;
  messenger_message_max_length: number;
  combined_status_ids_max: number;
  receive_count_min: number;
  receive_count_max: number;
  templates_take_min: number;
  templates_take_max: number;
  local_id_max_length: number;
}

describe("local_id", () => {
  // The golden table is shared byte-for-byte with the sibling SDK repositories,
  // so all five agree on what a local_id may be.
  const cases = fixtureJson<LocalIdCase[]>("validation/local_ids.json");

  it.each(cases)("$why", ({ value, valid }) => {
    if (valid) {
      expect(() => assertValidLocalId(value)).not.toThrow();
    } else {
      expect(() => assertValidLocalId(value)).toThrow(AdsefidValidationError);
    }
  });

  it("treats undefined as not supplied", () => {
    expect(() => assertValidLocalId(undefined)).not.toThrow();
  });

  it("names the offending field", () => {
    expect(() => assertValidLocalId("-bad", "receptors[0].local_id")).toThrow(
      /receptors\[0\]\.local_id/,
    );
  });

  it("exports the pattern for callers who want to pre-check", () => {
    expect(LOCAL_ID_PATTERN.test("order-10001")).toBe(true);
    expect(LOCAL_ID_PATTERN.test("-bad")).toBe(false);
  });
});

describe("max length counts UTF-16 code units", () => {
  /**
   * The service enforces its limits in UTF-16 code units, which is exactly what
   * `String.prototype.length` counts — so JavaScript agrees with the service
   * for free, including for characters outside the Basic Multilingual Plane.
   */
  const cases: Array<[string, string, boolean]> = [
    ["ascii at the limit", "a".repeat(900), false],
    ["ascii one over", "a".repeat(901), true],
    ["persian at the limit", "س".repeat(900), false],
    ["persian one over", "س".repeat(901), true],
    ["450 emoji is exactly 900 code units", "😀".repeat(450), false],
    ["451 emoji is 902 code units", "😀".repeat(451), true],
    ["900 emoji is 1800 code units", "😀".repeat(900), true],
  ];

  it.each(cases)("%s", (_name, value, rejected) => {
    const check = () => assertMaxLength(value, 900, "message");
    if (rejected) {
      expect(check).toThrow(AdsefidValidationError);
    } else {
      expect(check).not.toThrow();
    }
  });

  it("counts a surrogate pair as two", () => {
    expect("😀".length).toBe(2);
    expect("س".length).toBe(1);
  });
});

describe("the shared limits table", () => {
  it("matches what this SDK enforces", () => {
    const limits = fixtureJson<Limits>("validation/limits.json");

    expect(limits.sms_message_max_length).toBe(900);
    expect(limits.messenger_message_max_length).toBe(4000);
    expect(limits.combined_status_ids_max).toBe(2000);
    expect(limits.receive_count_min).toBe(1);
    expect(limits.receive_count_max).toBe(499);
    expect(limits.templates_take_min).toBe(1);
    expect(limits.templates_take_max).toBe(100);
  });

  it("is what the exported LIMITS constant enforces", () => {
    const limits = fixtureJson<Limits>("validation/limits.json");

    expect(LIMITS).toEqual({
      smsMessageMaxLength: limits.sms_message_max_length,
      messengerMessageMaxLength: limits.messenger_message_max_length,
      combinedStatusIdsMax: limits.combined_status_ids_max,
      receiveCountMin: limits.receive_count_min,
      receiveCountMax: limits.receive_count_max,
      templatesTakeMin: limits.templates_take_min,
      templatesTakeMax: limits.templates_take_max,
    });
    expect(limits.local_id_max_length).toBe(36);
  });
});

describe("assertRequired", () => {
  it.each([undefined, null, ""])("rejects %o", (value) => {
    expect(() => assertRequired(value, "receptor")).toThrow(AdsefidValidationError);
  });

  it("accepts a value", () => {
    expect(() => assertRequired("x", "receptor")).not.toThrow();
  });
});

describe("assertNonEmptyArray", () => {
  it.each([undefined, []])("rejects %o", (value) => {
    expect(() => assertNonEmptyArray(value as unknown[] | undefined, "receptors")).toThrow(
      AdsefidValidationError,
    );
  });

  it("accepts a populated array", () => {
    expect(() => assertNonEmptyArray(["a"], "receptors")).not.toThrow();
  });
});

describe("assertMaxCount", () => {
  it("is inclusive at the ceiling", () => {
    expect(() => assertMaxCount(2000, 2000, "ids")).not.toThrow();
    expect(() => assertMaxCount(2001, 2000, "ids")).toThrow(AdsefidValidationError);
  });
});

describe("assertInRange", () => {
  it.each([1, 250, 499])("accepts %i", (value) => {
    expect(() => assertInRange(value, 1, 499, "count")).not.toThrow();
  });

  it.each([0, -1, 500, 1.5, Number.NaN])("rejects %o", (value) => {
    expect(() => assertInRange(value, 1, 499, "count")).toThrow(AdsefidValidationError);
  });
});

describe("assertAtLeastOneProvided", () => {
  it("rejects when every list is empty or absent", () => {
    expect(() =>
      assertAtLeastOneProvided([
        { name: "message_ids", value: undefined },
        { name: "local_ids", value: [] },
      ]),
    ).toThrow(AdsefidValidationError);
  });

  it("accepts when any list has an entry", () => {
    expect(() =>
      assertAtLeastOneProvided([
        { name: "message_ids", value: ["a"] },
        { name: "local_ids", value: [] },
      ]),
    ).not.toThrow();
  });
});

describe("joinCsv", () => {
  it.each([
    [undefined, undefined],
    [[], undefined],
    [["a"], "a"],
    [["a", "b", "c"], "a,b,c"],
  ])("joins %o to %o", (values, expected) => {
    expect(joinCsv(values as string[] | undefined)).toBe(expected);
  });
});

describe("WebServiceCode guards", () => {
  it.each([
    [1000, true, false],
    [1002, true, false],
    [2025, false, true],
    [2014, false, true],
    [2046, false, true],
    [2047, false, true],
    // Codes this SDK does not know yet match neither guard.
    [1500, false, false],
    [2999, false, false],
    [0, false, false],
  ])("splits %i by range and known values", (code, isStatus, isError) => {
    expect(isWebServiceMessageStatus(code)).toBe(isStatus);
    expect(isWebServiceResponseCode(code)).toBe(isError);
  });

  it("maps the v1.13 response codes to HTTP statuses", () => {
    expect(WebServiceResponseCodeHttpStatus[WebServiceResponseCode.INVALID_MESSAGE_IDS]).toBe(400);
    expect(WebServiceResponseCodeHttpStatus[WebServiceResponseCode.FILE_TOO_LARGE]).toBe(413);
  });
});
