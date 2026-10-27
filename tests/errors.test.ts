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

  it("maps field errors to structured details", async () => {
    const user = userWith(400, fixtureText("errors/error.invalid_parameter.json"));

    const caught = (await user.getInfo().catch((err: unknown) => err)) as AdsefidApiError;

    expect(caught.details).toEqual({
      errors: {
        take: { code: 2024, name: "INVALID_PARAMETER" },
        state: { code: 2024, name: "INVALID_PARAMETER" },
      },
    });
  });

  it.each([
    [
      "single send field errors",
      "errors/error.details_single.json",
      { errors: { receptor: { code: 2014, name: "INVALID_RECEPTOR" } } },
    ],
    [
      "bulk item errors",
      "errors/error.details_bulk.json",
      {
        items: [
          { index: 0, errors: { receptor: { code: 2014, name: "INVALID_RECEPTOR" } } },
          {
            index: 2,
            errors: { local_id: { code: 2007, name: "DUPLICATE_LOCAL_ID" } },
          },
        ],
      },
    ],
    [
      "cancel errors keyed by rejected id",
      "errors/error.details_cancel.json",
      {
        errors: {
          "order-10001": { code: 2029, name: "INVALID_LOCAL_IDS" },
          "order-10002": { code: 2029, name: "INVALID_LOCAL_IDS" },
        },
      },
    ],
  ])("%s", async (_name, fixture, expected) => {
    const user = userWith(400, fixtureText(fixture as string));

    const caught = (await user.getInfo().catch((err: unknown) => err)) as AdsefidApiError;

    expect(caught.details).toEqual(expected);
  });

  it("preserves an unknown nested response code", async () => {
    const body = JSON.stringify({
      status: "error",
      error: {
        code: 2024,
        name: "INVALID_PARAMETER",
        details: { errors: { future: { code: 2999, name: "FUTURE_CODE" } } },
      },
    });

    const caught = (await userWith(400, body)
      .getInfo()
      .catch((err: unknown) => err)) as AdsefidApiError;

    expect(caught.details?.errors?.future?.code).toBe(2999);
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

describe("responses without an error envelope", () => {
  it.each([
    ["html 502", 502, "<html>bad gateway</html>", false, -1, "UNKNOWN_ERROR"],
    ["empty 500", 500, "", false, -1, "UNKNOWN_ERROR"],
    ["bare 429", 429, "", true, 2036, "RATE_LIMITED"],
    ["non-json 429", 429, "slow down", true, 2036, "RATE_LIMITED"],
  ])("%s", async (_name, status, body, rateLimited, code, codeName) => {
    const caught = (await userWith(status, body as string)
      .getInfo()
      .catch((err: unknown) => err)) as AdsefidApiError;

    expect(caught).toBeInstanceOf(AdsefidApiError);
    expect(caught.code).toBe(code);
    expect(caught.codeName).toBe(codeName);
    expect(caught instanceof AdsefidRateLimitError).toBe(rateLimited);
  });

  it("treats any 429 with an envelope as a rate limit", async () => {
    const body = '{"status":"error","error":{"code":2024,"name":"INVALID_PARAMETER"}}';
    const caught = await userWith(429, body)
      .getInfo()
      .catch((err: unknown) => err);

    expect(caught).toBeInstanceOf(AdsefidRateLimitError);
  });

  it.each([
    ["a non-JSON 200", "<html>ok</html>"],
    ["a success without data", '{"status":"success"}'],
    ["a success whose data is a list", '{"status":"success","data":[]}'],
  ])("%s is a transport error", async (_name, body) => {
    const caught = await userWith(200, body)
      .getInfo()
      .catch((err: unknown) => err);

    expect(caught).toBeInstanceOf(AdsefidTransportError);
  });

  it("maps a body with a missing array to a transport error, not a TypeError", async () => {
    const caught = await userWith(200, '{"status":"success","data":{"total":1}}')
      .getTemplates()
      .catch((err: unknown) => err);

    expect(caught).toBeInstanceOf(AdsefidTransportError);
  });
});

describe("per-call cancellation", () => {
  it("aborts a request when the caller's signal fires", async () => {
    const hanging: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const user = new UserResource(testConfig(fetchStub(), { fetchImpl: hanging }));
    const controller = new AbortController();

    const pending = user.getInfo({ signal: controller.signal }).catch((err: unknown) => err);
    controller.abort();
    const caught = (await pending) as AdsefidTransportError;

    expect(caught).toBeInstanceOf(AdsefidTransportError);
    expect(caught.message).toContain("aborted by the caller");
  });

  it("rejects without sending when the signal is already aborted", async () => {
    const stub = fetchStub({ body: "{}" });
    const user = new UserResource(testConfig(stub));

    const caught = await user.getInfo({ signal: AbortSignal.abort() }).catch((err: unknown) => err);

    expect(caught).toBeInstanceOf(AdsefidTransportError);
    expect(stub.calls).toHaveLength(0);
  });
});
