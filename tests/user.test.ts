import { describe, expect, it } from "vitest";
import { AdsefidValidationError } from "../src/errors.js";
import { UserResource } from "../src/resources/user.js";
import { fetchStub, queryOf, TEST_BASE_URL, testConfig } from "./helpers/fetchStub.js";
import { fixtureText } from "./helpers/fixtures.js";

function resourceFor(fixture: string) {
  const stub = fetchStub({ body: fixtureText(fixture) });
  return { user: new UserResource(testConfig(stub)), stub };
}

describe("account endpoints", () => {
  it("gets info", async () => {
    const { user, stub } = resourceFor("envelopes/user.get_info.success.json");

    const result = await user.getInfo();

    expect(stub.only().method).toBe("GET");
    expect(stub.only().url).toBe(`${TEST_BASE_URL}/v1/user/info`);
    expect(result.name).toBeTruthy();
  });

  it("gets lines", async () => {
    const { user, stub } = resourceFor("envelopes/user.get_lines.success.json");

    const result = await user.getLines();

    expect(stub.only().url).toBe(`${TEST_BASE_URL}/v1/user/lines`);
    expect(result.length).toBeGreaterThan(0);
  });

  it("gets profiles", async () => {
    const { user, stub } = resourceFor("envelopes/user.get_profiles.success.json");

    const result = await user.getProfiles();

    expect(stub.only().url).toBe(`${TEST_BASE_URL}/v1/user/profiles`);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("templates", () => {
  it("parses the documented shape", async () => {
    const { user, stub } = resourceFor("envelopes/user.get_templates.success.json");

    const result = await user.getTemplates({ state: "approved", skip: 0, take: 50 });

    const query = queryOf(stub.only());
    expect(query.get("state")).toBe("approved");
    expect(query.get("skip")).toBe("0");
    expect(query.get("take")).toBe("50");

    expect(result.total).toBe(1);
    expect(result.items[0]?.state).toBe("approved");
    expect(result.items[0]?.parameters).toEqual({ OTPCode: "string", amount: "number" });
    expect(result.items[0]?.description).toBeNull();
  });

  it("drops undocumented parameter types", async () => {
    // The live service emits a third type this SDK does not model. Dropping it
    // keeps the declared Record type honest at runtime.
    const { user } = resourceFor("envelopes/user.get_templates.unknown_type.json");

    const result = await user.getTemplates();

    expect(result.items[0]?.parameters).toEqual({ OTPCode: "string", amount: "number" });
    expect(result.items[0]?.parameters).not.toHaveProperty("link");
  });

  it("sends no query string when nothing was supplied", async () => {
    const { user, stub } = resourceFor("envelopes/user.get_templates.success.json");

    await user.getTemplates();

    expect(new URL(stub.only().url).search).toBe("");
  });

  it.each([1, 100])("accepts take=%i", async (take) => {
    const { user, stub } = resourceFor("envelopes/user.get_templates.success.json");

    await user.getTemplates({ take });

    expect(stub.calls).toHaveLength(1);
  });

  it.each([
    ["take below the minimum", { take: 0 }],
    ["take above the maximum", { take: 101 }],
    ["a negative skip", { skip: -1 }],
  ])("rejects %s before sending", async (_name, query) => {
    const { user, stub } = resourceFor("envelopes/user.get_templates.success.json");

    await expect(user.getTemplates(query)).rejects.toBeInstanceOf(AdsefidValidationError);
    expect(stub.calls).toHaveLength(0);
  });
});
