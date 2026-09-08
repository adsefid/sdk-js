/**
 * Delivery status, cancelling scheduled messages, and reading inbound SMS.
 *
 * Status and cancel both accept message IDs (ours) and local IDs (yours) in
 * one call; their combined distinct count may not exceed 2000, which the SDK
 * checks before making the request.
 *
 * Run with: npx tsx examples/status-and-cancel.ts
 */
import { AdsefidClient } from "../src/index.js";

const apiKey = process.env.ADSEFID_API_KEY;
const lineNumber = process.env.ADSEFID_LINE_NUMBER;
if (!apiKey || !lineNumber) {
  console.error("set ADSEFID_API_KEY and ADSEFID_LINE_NUMBER");
  process.exit(1);
}

const client = new AdsefidClient({ apiKey });

// Schedule far enough ahead that there is something to cancel.
const sendTime = new Date(Date.now() + 2 * 60 * 60_000);
const sent = await client.sms.sendSingle({
  receptor: "09120000000",
  line_number: lineNumber,
  message: "This one is scheduled, and about to be cancelled.",
  send_time: sendTime,
  local_id: "demo-cancel-1",
});
console.log(`scheduled ${sent.message_id} for ${sendTime.toISOString()}`);

// Look it up by our ID and by your own local_id at the same time.
const status = await client.sms.getStatus({
  message_ids: [sent.message_id],
  local_ids: ["demo-cancel-1"],
});
console.log(`\nstatus for ${status.receptors.length} message(s):`);
for (const item of status.receptors) {
  console.log(
    `  ${item.message_id} -> ${item.status} (delivered: ${item.delivery_time?.toISOString() ?? "not yet"})`,
  );
}

// Cancelling reports each message separately: one already sent cannot be
// recalled and comes back under failed_to_cancel.
const cancelled = await client.sms.cancel({ message_ids: [sent.message_id] });
console.log(
  `\ncancelled ${cancelled.cancelled_messages.length}, failed to cancel ${cancelled.failed_to_cancel.length}`,
);
for (const item of cancelled.failed_to_cancel) {
  console.log(`  ${item.message_id} could not be cancelled: ${item.status}`);
}

// Inbound messages. count must be 1..499; since filters by arrival time.
const received = await client.sms.getReceived({
  line_number: lineNumber,
  count: 50,
  since: new Date(Date.now() - 24 * 60 * 60_000),
});
console.log(`\n${received.messages.length} inbound message(s) in the last 24h:`);
for (const message of received.messages) {
  console.log(
    `  from ${message.sender} at ${message.receive_date.toISOString()}: ${message.message}`,
  );
}
