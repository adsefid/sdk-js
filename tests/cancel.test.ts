import { describe, expect, it } from "vitest";
import { AdsefidClient } from "../src/client.js";
import { AdsefidValidationError } from "../src/errors.js";
import { bodyJson, fetchStub, testConfig } from "./helpers/fetchStub.js";
import { fixtureText } from "./helpers/fixtures.js";

describe.each(["sms", "messenger"] as const)("%s cancellation", (area) => {
  it.each([
    [0, 0, 1, true],
    [2000, 0, 1, false],
    [2001, 0, 1, true],
    [0, 2000, 1, false],
    [0, 2001, 1, true],
    [1000, 1000, 1, false],
    [1000, 1001, 1, true],
    [1000, 1000, 3, false],
  ])(
    "checks %i message IDs + %i local IDs, repeated %i times (rejected=%s)",
    async (messageCount, localCount, repetitions, rejected) => {
      const ids = (count: number) =>
        Array.from({ length: count }, (_, i) =>
          Array<string>(repetitions).fill(`00000000-0000-0000-0000-${String(i).padStart(12, "0")}`),
        ).flat();
      const request = { message_ids: ids(messageCount), local_ids: ids(localCount) };
      const stub = fetchStub({ body: fixtureText(`envelopes/${area}.cancel.success.json`) });
      const client = new AdsefidClient(testConfig(stub));

      if (rejected) {
        await expect(client[area].cancel(request)).rejects.toBeInstanceOf(AdsefidValidationError);
        expect(stub.calls).toHaveLength(0);
      } else {
        await client[area].cancel(request);
        const call = stub.only();
        expect(call.method).toBe("POST");
        expect(new URL(call.url).pathname).toBe(`/v1/${area}/cancel`);
        expect(bodyJson(call)).toEqual(request);
      }
    },
  );
});
