import { describe, expect, it } from "vitest";
import {
  AdsefidApiError,
  AdsefidError,
  AdsefidRateLimitError,
  AdsefidTransportError,
  AdsefidValidationError,
} from "../src/errors.js";
import { UserResource } from "../src/resources/user.js";
import { fetchStub, rejectingFetchStub, testConfig } from "./helpers/fetchStub.js";
import { fixtureText } from "./helpers/fixtures.js";

function userWith(status: number, body: string) {
  const stub = fetchStub({ status, body });
  return new UserResource(testConfig(stub));
}

describe("error envelope mapping", () => {
  const cases = [
    {
      name: "unauthorized",
      fixture: "errors/error.invalid_api_key.json",
      status: 401,
      rateLimited: false,
      code: 2018,
      codeName: "UNAUTHORIZED",
    },
    {
      name: "message rate limit",
      fixture: "errors/error.rate_limit_message.json",
      status: 429,
      rateLimited: true,
      code: 2035,
      codeName: "MESSAGE_LIMIT_REACHED",
    },
    {
      // The envelope wins over the HTTP status: a 200 carrying an error
      // envelope is still an error.
      name: "request rate limit inside a 200",
      fixture: "errors/error.rate_limit_request.json",
      status: 200,
      rateLimited: true,
      code: 2036,
      codeName: "REQUEST_LIMIT_REACHED",
    },
    {
      name: "invalid parameter",
      fixture: "errors/error.invalid_parameter.json",
      status: 400,
      rateLimited: false,
      code: 2024,
      codeName: "INVALID_PARAMETER",
    },
    {
      name: "an unmapped future code",
      fixture: "errors/error.unknown_code.json",
      status: 400,
      rateLimited: false,
      code: 2999,
      codeName: "SOME_FUTURE_SERVER_ERROR",
    },
  ];

  it.each(cases)("maps $name", async ({ fixture, status, rateLimited, code, codeName }) => {
    const user = userWith(status, fixtureText(fixture));

    const caught = await user.getInfo().catch((err: unknown) => err);

    expect(caught).toBeInstanceOf(AdsefidApiError);
    const error = caught as AdsefidApiError;
    expect(error.code).toBe(code);
    expect(error.codeName).toBe(codeName);
    expect(error.httpStatusCode).toBe(status);
    expect(error instanceof AdsefidRateLimitError).toBe(rateLimited);
  });

  /**
   * The real shape of a validation failure: a field-to-message map under
   * `errors`, with plain string values.
   */
  it("keeps a validation details payload intact", async () => {
    const user = userWith(400, fixtureText("errors/error.invalid_parameter.json"));

    const caught = (await user.getInfo().catch((err: unknown) => err)) as AdsefidApiError;

    expect(caught.details).toEqual({
      errors: {
        take: "invalid value for take",
        state: "invalid value for state",
      },
    });
  });

  /**
   * `details` is typed `unknown` precisely because the service uses a different
   * shape per endpoint. Each real shape must come through uncoerced.
   */
  it.each([
    [
      "single send is a flat field to message map",
      "errors/error.details_single.json",
      { receptor: "invalid value for receptor" },
    ],
    [
      "bulk carries per-item errors keyed by index",
      "errors/error.details_bulk.json",
      {
        errors: { line_number: "invalid value for line_number" },
        messages: [
          { index: 0, errors: { receptor: "invalid value for receptor" } },
          {
            index: 2,
            errors: {
              local_id: "invalid value for local_id",
              message: "invalid value for message",
            },
          },
        ],
      },
    ],
    [
      "cancel is the one shape whose values are arrays",
      "errors/error.details_cancel.json",
      { local_ids: ["order-10001", "order-10002"] },
    ],
  ])("%s", async (_name, fixture, expected) => {
    const user = userWith(400, fixtureText(fixture as string));

    const caught = (await user.getInfo().catch((err: unknown) => err)) as AdsefidApiError;

    expect(caught.details).toEqual(expected);
  });
});

describe("responses with no usable envelope", () => {
  it("maps a 500 with an HTML body to an API error", async () => {
    const user = userWith(500, fixtureText("errors/error.not_json.txt"));

    const caught = await user.getInfo().catch((err: unknown) => err);

    // An HTML body is not JSON, so it fails at the parse step.
    expect(caught).toBeInstanceOf(AdsefidError);
    expect(caught).not.toBeInstanceOf(AdsefidValidationError);
  });

  it("treats a bare 429 as a rate limit", async () => {
    const user = userWith(429, "");

    await expect(user.getInfo()).rejects.toBeInstanceOf(AdsefidRateLimitError);
  });

  it.each([
    ["a 500 with an empty body", 500, ""],
    ["a 400 with an empty body", 400, ""],
  ])("maps %s to an API error", async (_name, status, body) => {
    await expect(userWith(status, body).getInfo()).rejects.toBeInstanceOf(AdsefidApiError);
  });
});

describe("transport failures", () => {
  it("wraps a network error", async () => {
    const stub = rejectingFetchStub(new TypeError("fetch failed"));
    const user = new UserResource(testConfig(stub));

    await expect(user.getInfo()).rejects.toBeInstanceOf(AdsefidTransportError);
  });

  it("wraps an abort as a transport error", async () => {
    const abort = new Error("The operation was aborted");
    abort.name = "AbortError";
    const stub = rejectingFetchStub(abort);
    const user = new UserResource(testConfig(stub));

    await expect(user.getInfo()).rejects.toBeInstanceOf(AdsefidTransportError);
  });
});

describe("the error hierarchy", () => {
  /**
   * A rate limit is an API error, so `catch (e) { if (e instanceof
   * AdsefidApiError) }` also catches it. Callers who want to treat rate limits
   * specially must check the narrower class first.
   */
  it("nests rate limit under api under the base error", () => {
    const error = new AdsefidRateLimitError({
      message: "m",
      code: 2036,
      codeName: "REQUEST_LIMIT_REACHED",
      httpStatusCode: 429,
    });

    expect(error).toBeInstanceOf(AdsefidRateLimitError);
    expect(error).toBeInstanceOf(AdsefidApiError);
    expect(error).toBeInstanceOf(AdsefidError);
    expect(error).toBeInstanceOf(Error);
  });

  it("keeps instanceof working across the transpiled class chain", () => {
    // Object.setPrototypeOf in each constructor is what makes this hold when
    // the classes are down-levelled; assert it so a refactor cannot drop it.
    expect(new AdsefidValidationError("m", "f")).toBeInstanceOf(AdsefidError);
    expect(new AdsefidTransportError("m")).toBeInstanceOf(AdsefidError);
  });

  it("exposes the offending field on a validation error", () => {
    expect(new AdsefidValidationError("m", "receptor").field).toBe("receptor");
  });

  it("does not shadow Error.prototype.name with the API error name", () => {
    const error = new AdsefidApiError({
      message: "m",
      code: 2024,
      codeName: "INVALID_PARAMETER",
      httpStatusCode: 400,
    });

    expect(error.name).toBe("AdsefidApiError");
    expect(error.codeName).toBe("INVALID_PARAMETER");
  });
});
