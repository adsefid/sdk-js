/**
 * Account endpoints, plus configuring the client beyond the defaults.
 *
 * Nothing here sends a message, so it is the safest example to run first
 * against a real API key.
 *
 * Run with: npx tsx examples/account.ts
 */
import { AdsefidClient } from "../src/index.js";

const apiKey = process.env.ADSEFID_API_KEY;
if (!apiKey) {
  console.error("set ADSEFID_API_KEY");
  process.exit(1);
}

const client = new AdsefidClient({
  apiKey,
  // baseUrl is normally only needed to point at a mock server.
  baseUrl: process.env.ADSEFID_BASE_URL ?? "https://api.adsefid.com",
  timeoutMs: 20_000,
  // Identify your own application; the SDK's default is "adsefid-js/<version>".
  userAgent: "my-billing-service/1.4 (+https://example.com)",
  // The SDK never retries. If you want retries, a proxy, or tracing, wrap
  // fetch yourself and pass it in:
  fetchImpl: (input, init) => {
    const started = Date.now();
    return fetch(input, init).then((response) => {
      console.error(`[http] ${response.status} in ${Date.now() - started}ms`);
      return response;
    });
  },
});

const info = await client.user.getInfo();
console.log(`account ${info.name} (${info.account_status})`);
console.log(`  credit left: ${info.credit_left}`);
if (info.email) {
  console.log(`  email: ${info.email}`);
}

const lines = await client.user.getLines();
console.log(`\n${lines.length} SMS line(s):`);
for (const line of lines) {
  console.log(
    `  ${line.line_number} ${line.line_name} ${line.enabled ? "enabled" : "disabled"} (selector ${line.line_selector})`,
  );
}

const profiles = await client.user.getProfiles();
console.log(`\n${profiles.length} messenger profile(s):`);
for (const profile of profiles) {
  console.log(`  ${profile.id} ${profile.name} (${profile.messenger})`);
}

// Templates are paged; take is capped at 100.
const page = await client.user.getTemplates({ skip: 0, take: 100 });
console.log(`\n${page.total} template(s) (showing ${page.items.length}):`);
for (const item of page.items) {
  console.log(
    `  ${item.template_id} ${item.state} ${Object.keys(item.parameters).length} parameter(s)`,
  );
}
