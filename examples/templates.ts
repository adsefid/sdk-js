/**
 * Listing templates and sending one, with exact numeric parameter values.
 *
 * A parameter the template declares as `number` may be sent either as a JSON
 * number or as a JSON string, and the service substitutes a numeric string
 * verbatim. Since JavaScript numbers are IEEE-754 doubles, a string is the
 * only way to express a value whose exact digits matter — "001234" keeps its
 * leading zeros and "1.50" its trailing zero.
 *
 * Run with: npx tsx examples/templates.ts
 */
import { AdsefidClient, type TemplateParameters } from "../src/index.js";

const apiKey = process.env.ADSEFID_API_KEY;
const lineNumber = process.env.ADSEFID_LINE_NUMBER;
if (!apiKey || !lineNumber) {
  console.error("set ADSEFID_API_KEY and ADSEFID_LINE_NUMBER");
  process.exit(1);
}

const client = new AdsefidClient({ apiKey });

const page = await client.user.getTemplates({ state: "approved", take: 100 });
if (page.items.length === 0) {
  console.error(
    "no approved templates on this account — create one in the adsefid.com panel first",
  );
  process.exit(1);
}

console.log(`${page.total} approved template(s):`);
for (const item of page.items) {
  console.log(`  ${item.template_id}: ${item.content}`);
}

const template = page.items[0];
if (!template) {
  process.exit(1);
}

// Build one value per declared parameter. A `number` parameter gets a string
// here so its exact form survives.
const parameters: TemplateParameters = {};
for (const [name, kind] of Object.entries(template.parameters)) {
  parameters[name] = kind === "string" ? "Ali" : "1.50";
}

const result = await client.sms.sendTemplate({
  template_id: template.template_id,
  parameters,
  receptor: "09120000000",
  line_number: lineNumber,
  // Datetimes are plain ISO-8601 strings throughout this SDK; it never builds
  // a Date for you.
  expiry_date: new Date(Date.now() + 10 * 60_000).toISOString(),
});

console.log(`\nsent ${result.message_id}: status ${result.status}`);
console.log(`  rendered: ${result.message}`);
console.log(`  parameters echoed back: ${JSON.stringify(result.parameters)}`);

// Which representation to reach for, shown without sending anything.
console.log("\nchoosing a parameter value:");
for (const [why, value] of [
  ["an ordinary count", 2],
  ["a price where float rounding is fine", 19.99],
  ["an invoice number whose leading zeros matter", "001234"],
  ["an amount that must render as exactly 1.50", "1.50"],
] as const) {
  console.log(`  ${why.padEnd(48)} -> ${JSON.stringify(value)}`);
}
