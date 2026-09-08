import { beforeEach, describe, expect, it } from "vitest";
import { AdsefidClient } from "../src/client.js";
import { AdsefidValidationError } from "../src/errors.js";
import { SmsResource } from "../src/resources/sms.js";
import {
  bodyJson,
  fetchStub,
  queryOf,
  TEST_API_KEY,
  TEST_BASE_URL,
  testConfig,
} from "./helpers/fetchStub.js";
import { fixtureText } from "./helpers/fixtures.js";

function resourceFor(fixture: string) {
  const stub = fetchStub({ body: fixtureText(fixture) });
  return { sms: new SmsResource(testConfig(stub)), stub };
}

describe("request building", () => {
  it("sends a single SMS with only the fields that were supplied", async () => {
    const { sms, stub } = resourceFor("envelopes/sms.send_single.success.json");

    await sms.sendSingle({
      receptor: "98912xxxxxxx",
      line_number: "3000xxxx",
      message: "hello",
    });

    const call = stub.only();
    expect(call.method).toBe("POST");
    expect(call.url).toBe(`${TEST_BASE_URL}/v1/sms/single`);
    expect(call.headers["X-API-KEY"]).toBe(TEST_API_KEY);
    expect(call.headers["User-Agent"]).toMatch(/^adsefid-js\//);
    expect(bodyJson(call)).toEqual({
      receptor: "98912xxxxxxx",
      line_number: "3000xxxx",
      message: "hello",
    });
    // An omitted optional must be absent, not null.
    for (const key of ["send_time", "local_id", "hide", "line_selector"]) {
      expect(bodyJson(call)).not.toHaveProperty(key);
    }
  });

  it("passes every supplied optional through", async () => {
    const { sms, stub } = resourceFor("envelopes/sms.send_single.success.json");

    await sms.sendSingle({
      receptor: "98912xxxxxxx",
      line_number: "3000xxxx",
      message: "hello",
      local_id: "order-1",
      hide: true,
      line_selector: 2,
      send_time: "2026-04-04T11:00:00+03:30",
    });

    expect(bodyJson(stub.only())).toMatchObject({
      local_id: "order-1",
      hide: true,
      line_selector: 2,
      send_time: "2026-04-04T11:00:00+03:30",
    });
  });

  it("joins status ids into CSV query params", async () => {
    const { sms, stub } = resourceFor("envelopes/sms.get_status.success.json");

    await sms.getStatus({ message_ids: ["m1", "m2"], local_ids: ["l1"] });

    const call = stub.only();
    expect(call.method).toBe("GET");
    const query = queryOf(call);
    expect(query.get("message_ids")).toBe("m1,m2");
    expect(query.get("local_ids")).toBe("l1");
  });

  it("omits a CSV param entirely when its array is empty", async () => {
    const { sms, stub } = resourceFor("envelopes/sms.get_status.success.json");

    await sms.getStatus({ message_ids: ["m1"], local_ids: [] });

    const query = queryOf(stub.only());
    expect(query.get("message_ids")).toBe("m1");
    expect(query.has("local_ids")).toBe(false);
  });

  it("builds the receive query", async () => {
    const { sms, stub } = resourceFor("envelopes/sms.get_received.success.json");

    await sms.getReceived({ line_number: "3000xxxx", count: 10 });

    const query = queryOf(stub.only());
    expect(query.get("line_number")).toBe("3000xxxx");
    expect(query.get("count")).toBe("10");
    expect(query.has("since")).toBe(false);
  });
});

describe("template parameters", () => {
  /**
   * A number-typed parameter sent as a string keeps its exact digits: the
   * service substitutes such a value verbatim. JavaScript numbers are IEEE-754
   * doubles, so a string is the only way to express 001234 or an exact 1.50.
   */
  it("keeps leading zeros and exact decimals when sent as strings", async () => {
    const { sms, stub } = resourceFor("envelopes/sms.send_template.success.json");

    await sms.sendTemplate({
      template_id: "otp_login",
      parameters: {
        code: "459122",
        invoice: "001234",
        exact_amount: "1.50",
        quantity: 2,
        rate: 19.99,
      },
      receptor: "98912xxxxxxx",
      line_number: "3000xxxx",
    });

    expect(bodyJson(stub.only()).parameters).toEqual({
      code: "459122",
      invoice: "001234",
      exact_amount: "1.50",
      quantity: 2,
      rate: 19.99,
    });
  });

  it("shows why a number literal would not do", () => {
    // Documented here so the reason the SDK accepts strings stays visible.
    expect(JSON.stringify(1234)).toBe("1234");
    expect(JSON.stringify(1.5)).toBe("1.5");
    expect(JSON.stringify("001234")).toBe('"001234"');
    expect(JSON.stringify("1.50")).toBe('"1.50"');
  });

  it("echoes the response parameters back", async () => {
    const { sms } = resourceFor("envelopes/sms.send_template.success.json");

    const result = await sms.sendTemplate({
      template_id: "otp_login",
      parameters: { code: "459122" },
      receptor: "98912xxxxxxx",
      line_number: "3000xxxx",
    });

    expect(result.parameters).toEqual({ code: "459122", minutes: 2 });
  });
});

describe("response parsing", () => {
  it("parses a single send", async () => {
    const { sms } = resourceFor("envelopes/sms.send_single.success.json");

    const result = await sms.sendSingle({
      receptor: "98912xxxxxxx",
      line_number: "3000xxxx",
      message: "hi",
    });

    expect(result.status).toBe(1000);
    expect(result.segment_count).toBe(1);
    expect(result.cost).toBe(120);
    // Datetimes stay plain ISO-8601 strings; this SDK never builds a Date.
    expect(typeof result.send_time).toBe("string");
  });

  it("parses a cancel result", async () => {
    const { sms } = resourceFor("envelopes/sms.cancel.success.json");

    const result = await sms.cancel({ message_ids: ["m1"] });

    expect(Array.isArray(result.cancelled_messages)).toBe(true);
    expect(Array.isArray(result.failed_to_cancel)).toBe(true);
  });

  it("parses received messages", async () => {
    const { sms } = resourceFor("envelopes/sms.get_received.success.json");

    const result = await sms.getReceived({ line_number: "3000xxxx" });

    expect(result.messages.length).toBeGreaterThan(0);
    expect(typeof result.messages[0]?.receive_date).toBe("string");
  });
});

describe("partial success is not an error", () => {
  it("returns bulk results with per-receptor failure codes intact", async () => {
    const { sms } = resourceFor("envelopes/sms.send_bulk.partial_success.json");

    const result = await sms.sendBulk({
      receptors: [{ receptor: "a" }, { receptor: "b" }],
      message: "m",
      line_number: "3000xxxx",
    });

    expect(result.receptors).toHaveLength(2);
    expect(result.receptors[0]?.status).toBe(1000);
    // 2025 RECEPTOR_BLACKLISTED is a response code, not a message status.
    expect(result.receptors[1]?.status).toBe(2025);
    expect(result.receptors[1]?.message_id).toBeNull();
    expect(result.counts["2025"]).toBe(1);
    expect(result.total_count).toBe(2);
  });

  it("returns p2p results with per-message failure codes intact", async () => {
    const { sms } = resourceFor("envelopes/sms.send_p2p.partial_success.json");

    const result = await sms.sendP2P({
      messages: [{ receptor: "a", message: "x" }],
      line_number: "3000xxxx",
    });

    expect(result.messages.map((m) => m.status)).toEqual([1000, 2014]);
  });
});

describe("validation rejects before any request is sent", () => {
  let stub: ReturnType<typeof fetchStub>;
  let sms: SmsResource;

  beforeEach(() => {
    stub = fetchStub({ body: fixtureText("envelopes/sms.send_single.success.json") });
    sms = new SmsResource(testConfig(stub));
  });

  const cases: Array<[string, () => Promise<unknown>]> = [
    ["empty receptor", () => sms.sendSingle({ receptor: "", line_number: "3000", message: "m" })],
    ["empty line number", () => sms.sendSingle({ receptor: "a", line_number: "", message: "m" })],
    ["empty message", () => sms.sendSingle({ receptor: "a", line_number: "3000", message: "" })],
    [
      "message over 900 UTF-16 units",
      () => sms.sendSingle({ receptor: "a", line_number: "3000", message: "x".repeat(901) }),
    ],
    [
      "invalid local id",
      () => sms.sendSingle({ receptor: "a", line_number: "3000", message: "m", local_id: "-bad" }),
    ],
    ["no receptors", () => sms.sendBulk({ receptors: [], message: "m", line_number: "3000" })],
    ["no messages", () => sms.sendP2P({ messages: [], line_number: "3000" })],
    ["status with neither id list", () => sms.getStatus({})],
    ["cancel with neither id list", () => sms.cancel({})],
    ["receive count of zero", () => sms.getReceived({ line_number: "3000", count: 0 })],
    ["receive count over 499", () => sms.getReceived({ line_number: "3000", count: 500 })],
    ["receive with empty line number", () => sms.getReceived({ line_number: "" })],
  ];

  it.each(cases)("rejects %s", async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(AdsefidValidationError);
    expect(stub.calls).toHaveLength(0);
  });

  it("accepts the receive count boundaries", async () => {
    for (const count of [1, 250, 499]) {
      const local = fetchStub({ body: fixtureText("envelopes/sms.get_received.success.json") });
      await new SmsResource(testConfig(local)).getReceived({ line_number: "3000", count });
      expect(local.calls).toHaveLength(1);
    }
  });

  it("counts distinct ids against the 2000 ceiling", async () => {
    const atLimit = Array.from({ length: 2000 }, (_, i) => `id-${i}`);
    const ok = fetchStub({ body: fixtureText("envelopes/sms.get_status.success.json") });
    await new SmsResource(testConfig(ok)).getStatus({ message_ids: atLimit });
    expect(ok.calls).toHaveLength(1);

    const tooMany = fetchStub({ body: fixtureText("envelopes/sms.get_status.success.json") });
    await expect(
      new SmsResource(testConfig(tooMany)).getStatus({ message_ids: [...atLimit, "one-more"] }),
    ).rejects.toBeInstanceOf(AdsefidValidationError);
    expect(tooMany.calls).toHaveLength(0);

    // Duplicates collapse, so they cannot push a valid call over the limit.
    const duplicates = fetchStub({ body: fixtureText("envelopes/sms.get_status.success.json") });
    await new SmsResource(testConfig(duplicates)).getStatus({
      message_ids: Array.from({ length: 2050 }, () => "same"),
    });
    expect(duplicates.calls).toHaveLength(1);
  });
});

describe("the client wires up the sms resource", () => {
  it("routes through client.sms", async () => {
    const stub = fetchStub({ body: fixtureText("envelopes/sms.send_single.success.json") });
    const client = new AdsefidClient({
      apiKey: TEST_API_KEY,
      baseUrl: TEST_BASE_URL,
      fetchImpl: stub.fetchImpl,
    });

    await client.sms.sendSingle({ receptor: "a", line_number: "3000", message: "m" });

    expect(stub.only().url).toBe(`${TEST_BASE_URL}/v1/sms/single`);
  });
});
