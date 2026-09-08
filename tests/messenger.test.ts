import { beforeEach, describe, expect, it } from "vitest";
import { AdsefidValidationError } from "../src/errors.js";
import { buildFileFormData } from "../src/multipart.js";
import { MessengerResource } from "../src/resources/messenger.js";
import { bodyJson, fetchStub, queryOf, TEST_BASE_URL, testConfig } from "./helpers/fetchStub.js";
import { fixtureText } from "./helpers/fixtures.js";

// @types/node 18 (this SDK's floor) does not declare the global `File`, though
// the runtime has it from Node 18 on. Describe just the shape the tests read.
type UploadedFile = Blob & { name: string };

function resourceFor(fixture: string) {
  const stub = fetchStub({ body: fixtureText(fixture) });
  return { messenger: new MessengerResource(testConfig(stub)), stub };
}

describe("request building", () => {
  it("sends a single message with only the fields that were supplied", async () => {
    const { messenger, stub } = resourceFor("envelopes/messenger.send_single.success.json");

    await messenger.sendSingle({ message: "hi", receptor: "98912xxxxxxx", profile: "profile-1" });

    const call = stub.only();
    expect(call.method).toBe("POST");
    expect(call.url).toBe(`${TEST_BASE_URL}/v1/messenger/single`);
    for (const key of ["hide", "file_id", "send_time", "local_id"]) {
      expect(bodyJson(call)).not.toHaveProperty(key);
    }
  });

  it("builds the status query", async () => {
    const { messenger, stub } = resourceFor("envelopes/messenger.get_status.success.json");

    await messenger.getStatus({ message_ids: ["m1"], local_ids: ["l1"] });

    const query = queryOf(stub.only());
    expect(query.get("message_ids")).toBe("m1");
    expect(query.get("local_ids")).toBe("l1");
  });

  it("keeps leading zeros in template parameters", async () => {
    const { messenger, stub } = resourceFor("envelopes/messenger.send_template.success.json");

    await messenger.sendTemplate({
      template_id: "invoice_notice",
      parameters: { invoice: "001234", amount: 2 },
      receptor: "98912xxxxxxx",
      profile: "p",
    });

    expect(bodyJson(stub.only()).parameters).toEqual({ invoice: "001234", amount: 2 });
  });
});

describe("partial success is not an error", () => {
  it("returns bulk results with per-receptor failure codes intact", async () => {
    const { messenger } = resourceFor("envelopes/messenger.send_bulk.partial_success.json");

    const result = await messenger.sendBulk({
      receptors: [{ receptor: "a" }, { receptor: "b" }],
      message: "m",
      profile: "p",
    });

    expect(result.receptors.map((r) => r.status)).toEqual([1000, 2025]);
    expect(result.receptors[1]?.message_id).toBeNull();
    expect(result.counts["2025"]).toBe(1);
  });

  it("returns p2p results with per-receptor failure codes intact", async () => {
    const { messenger } = resourceFor("envelopes/messenger.send_p2p.partial_success.json");

    const result = await messenger.sendP2P({
      receptors: [{ receptor: "a", message: "m" }],
      profile: "p",
    });

    expect(result.receptors.map((r) => r.status)).toEqual([1000, 2014]);
  });
});

describe("file upload", () => {
  it("posts a FormData with the file under the documented field name", async () => {
    const { messenger, stub } = resourceFor("envelopes/messenger.upload_file.success.json");

    const result = await messenger.uploadFile({
      file: new Blob(["file-contents-here"]),
      filename: "invoice.pdf",
      contentType: "application/pdf",
    });

    const call = stub.only();
    expect(call.url).toBe(`${TEST_BASE_URL}/v1/messenger/file`);
    // Assert on the FormData object, not on serialized bytes: `fetch` picks the
    // multipart boundary itself, so a byte comparison would be meaningless.
    expect(call.body).toBeInstanceOf(FormData);
    const uploaded = (call.body as FormData).get("file") as UploadedFile;
    expect(uploaded.name).toBe("invoice.pdf");
    expect(uploaded.type).toBe("application/pdf");
    expect(await uploaded.text()).toBe("file-contents-here");

    expect(result.file_id).toBeTruthy();
  });

  it("does not set Content-Type itself, so fetch can add the boundary", async () => {
    const { messenger, stub } = resourceFor("envelopes/messenger.upload_file.success.json");

    await messenger.uploadFile({
      file: new Blob(["x"]),
      filename: "a.txt",
      contentType: "text/plain",
    });

    expect(stub.only().headers).not.toHaveProperty("Content-Type");
  });

  describe("buildFileFormData accepts every documented source", () => {
    it("a Blob", async () => {
      const form = await buildFileFormData({
        file: new Blob(["blob"]),
        filename: "a.txt",
        contentType: "text/plain",
      });
      const file = form.get("file") as UploadedFile;
      expect(await file.text()).toBe("blob");
      expect(file.type).toBe("text/plain");
    });

    it("an ArrayBuffer", async () => {
      const form = await buildFileFormData({
        file: new TextEncoder().encode("buffer").buffer as ArrayBuffer,
        filename: "b.bin",
        contentType: "application/octet-stream",
      });
      const file = form.get("file") as UploadedFile;
      expect(await file.text()).toBe("buffer");
      expect(file.name).toBe("b.bin");
    });

    it("a ReadableStream", async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("stream"));
          controller.close();
        },
      });

      const form = await buildFileFormData({ file: stream, filename: "c.txt" });
      const file = form.get("file") as UploadedFile;
      expect(await file.text()).toBe("stream");
    });

    it("leaves the Blob type alone when no contentType is given", async () => {
      const form = await buildFileFormData({
        file: new Blob(["x"], { type: "image/png" }),
        filename: "d.png",
      });
      expect((form.get("file") as UploadedFile).type).toBe("image/png");
    });
  });
});

describe("validation rejects before any request is sent", () => {
  let stub: ReturnType<typeof fetchStub>;
  let messenger: MessengerResource;

  beforeEach(() => {
    stub = fetchStub({ body: fixtureText("envelopes/messenger.send_single.success.json") });
    messenger = new MessengerResource(testConfig(stub));
  });

  const cases: Array<[string, () => Promise<unknown>]> = [
    ["empty message", () => messenger.sendSingle({ message: "", receptor: "a", profile: "p" })],
    ["empty profile", () => messenger.sendSingle({ message: "m", receptor: "a", profile: "" })],
    [
      "message over 4000 units",
      () => messenger.sendSingle({ message: "x".repeat(4001), receptor: "a", profile: "p" }),
    ],
    ["no receptors", () => messenger.sendBulk({ receptors: [], message: "m", profile: "p" })],
    ["cancel with neither id list", () => messenger.cancel({})],
    ["status with neither id list", () => messenger.getStatus({})],
    [
      "upload with an empty filename",
      () => messenger.uploadFile({ file: new Blob(["x"]), filename: "" }),
    ],
  ];

  it.each(cases)("rejects %s", async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(AdsefidValidationError);
    expect(stub.calls).toHaveLength(0);
  });
});
