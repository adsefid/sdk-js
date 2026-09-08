/**
 * The Messenger resource end to end: upload an attachment, send it, check status.
 *
 * Messenger sends go through a "profile" configured in your adsefid.com panel
 * rather than an SMS line, and allow a longer body (4000 characters against
 * SMS's 900). File upload is the only multipart endpoint in the API; the SDK
 * builds a native FormData and lets fetch pick the boundary.
 *
 * Run with: npx tsx examples/messenger.ts
 */
import { readFile } from "node:fs/promises";
import { AdsefidClient } from "../src/index.js";

const apiKey = process.env.ADSEFID_API_KEY;
if (!apiKey) {
  console.error("set ADSEFID_API_KEY");
  process.exit(1);
}

const client = new AdsefidClient({ apiKey });

const profiles = await client.user.getProfiles();
if (profiles.length === 0) {
  console.error("no messenger profiles on this account — add one in the adsefid.com panel first");
  process.exit(1);
}
console.log(`${profiles.length} messenger profile(s):`);
for (const profile of profiles) {
  console.log(`  ${profile.id} ${profile.name} (${profile.messenger})`);
}

// uploadFile accepts a Blob, an ArrayBuffer, or a ReadableStream. Reading a
// real file gives you a Buffer, whose .buffer is an ArrayBuffer:
const attachmentPath = process.env.ADSEFID_ATTACHMENT;
const attachment = attachmentPath
  ? new Blob([await readFile(attachmentPath)])
  : new Blob(["Statement for September 2026\nTotal: 1,250,000 IRR\n"]);

const uploaded = await client.messenger.uploadFile({
  file: attachment,
  filename: attachmentPath ?? "statement.txt",
  contentType: "text/plain",
});
console.log(`\nuploaded attachment as file_id ${uploaded.file_id}`);

const profile = profiles[0];
if (!profile) {
  process.exit(1);
}

const sent = await client.messenger.sendSingle({
  message: "Your statement is attached.",
  receptor: "09120000000",
  profile: profile.id,
  file_id: uploaded.file_id,
  local_id: "statement-2026-09",
});
console.log(
  `\nsent ${sent.message_id} via ${sent.messenger}: status ${sent.status}, cost ${sent.cost}`,
);

const status = await client.messenger.getStatus({ message_ids: [sent.message_id] });
for (const item of status.receptors) {
  console.log(`  ${item.message_id} -> ${item.status}`);
}
