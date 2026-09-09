/**
 * Bulk and P2P SMS sends, and how to read a partial success.
 *
 * Both endpoints answer HTTP 200 even when some receptors failed, so a call
 * that did not throw still needs its per-item results inspected. `status` on
 * each item is the WebServiceCode the service sent: the isWebServiceMessageStatus
 * and isWebServiceResponseCode guards tell an accepted item from a rejected one.
 *
 * Run with: npx tsx examples/bulk-and-p2p.ts
 */
import { AdsefidClient, isWebServiceResponseCode } from "../src/index.js";

const apiKey = process.env.ADSEFID_API_KEY;
const lineNumber = process.env.ADSEFID_LINE_NUMBER;
if (!apiKey || !lineNumber) {
  console.error("set ADSEFID_API_KEY and ADSEFID_LINE_NUMBER");
  process.exit(1);
}

const client = new AdsefidClient({ apiKey });

function report(
  receptor: string,
  localId: string | null,
  status: number,
  messageId: string | null,
): void {
  const label = localId ?? "-";
  if (isWebServiceResponseCode(status)) {
    console.log(`  ${receptor} (${label}) FAILED with code ${status}`);
    return;
  }
  console.log(`  ${receptor} (${label}) accepted as ${messageId}, status ${status}`);
}

// One identical message to many receptors. `local_id` is your own handle: it
// comes back here and on the status webhook, so you can match a delivery
// report to your own record without storing our message IDs.
const bulk = await client.sms.sendBulk({
  line_number: lineNumber,
  message: "Scheduled maintenance tonight from 01:00 to 03:00.",
  receptors: [
    { receptor: "09120000000", local_id: "maint-1" },
    { receptor: "09120000001", local_id: "maint-2" },
  ],
});

console.log(
  `\nbulk group ${bulk.group_id}: ${bulk.total_count} receptors, cost ${bulk.total_cost}`,
);
for (const item of bulk.receptors) {
  report(item.receptor, item.local_id, item.status, item.message_id);
}
console.log(`  status histogram: ${JSON.stringify(bulk.counts)}`);

// A different message per receptor, in one request.
const p2p = await client.sms.sendP2P({
  line_number: lineNumber,
  messages: [
    {
      receptor: "09120000000",
      message: "Hi Ali, your order #1001 shipped.",
      local_id: "ship-1001",
    },
    {
      receptor: "09120000001",
      message: "Hi Reza, your order #1002 shipped.",
      local_id: "ship-1002",
    },
  ],
});

console.log(`\np2p group ${p2p.group_id}: cost ${p2p.total_cost}`);
for (const item of p2p.messages) {
  report(item.receptor, item.local_id, item.status, item.message_id);
}
