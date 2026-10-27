import { describe, expect, it } from "vitest";
import { SmsResource } from "../src/resources/sms.js";
import { UserResource } from "../src/resources/user.js";
import { fetchStub, testConfig } from "./helpers/fetchStub.js";
import { fixtureText } from "./helpers/fixtures.js";

// Fixtures shaped like real gateway responses: 7-digit fractional seconds, an empty-string
// description, null account fields, long decimal money and "+98" receptors.
describe("live-shaped responses", () => {
  const user = (fixture: string) =>
    new UserResource(testConfig(fetchStub({ body: fixtureText(fixture) })));
  const sms = (fixture: string) =>
    new SmsResource(testConfig(fetchStub({ body: fixtureText(fixture) })));

  it("account info keeps null fields", async () => {
    const info = await user("envelopes/user.get_info.live.json").getInfo();

    expect(info.company_name).toBeNull();
    expect(info.email).toBeNull();
    expect(info.credit_left).toBe(5877471300);
  });

  it("templates parse 7-digit timestamps and an empty description", async () => {
    const { items } = await user("envelopes/user.get_templates.live.json").getTemplates();

    expect(items[0]?.description).toBe("");
    expect(items[0]?.created_at.toISOString()).toBe("2026-09-19T08:13:10.403Z");
  });

  it("template send keeps a normalized receptor and a null expiry", async () => {
    const response = await sms("envelopes/sms.send_template.live.json").sendTemplate({
      template_id: "otp",
      parameters: { otp_code: "001234" },
      receptor: "989120000000",
      line_number: "983000",
    });

    expect(response.receptor).toBe("+989120000000");
    expect(response.expiry_date).toBeNull();
    expect(response.cost).toBe(1129);
    expect(response.send_time?.toISOString()).toBe("2026-10-27T09:48:20.921Z");
  });

  it("status parses a 7-digit delivery time", async () => {
    const { receptors } = await sms("envelopes/sms.get_status.live.json").getStatus({
      local_ids: ["order-10001"],
    });

    expect(receptors[0]?.status).toBe(1003);
    expect(receptors[0]?.delivery_time?.toISOString()).toBe("2026-10-27T09:48:26.953Z");
  });
});
