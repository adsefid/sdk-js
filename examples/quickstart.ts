/**
 * Minimal end-to-end example: send a single SMS and handle the SDK's typed
 * errors. Run with:
 *
 *   ADSEFID_API_KEY=... npx tsx examples/quickstart.ts
 */
import {
  AdsefidApiError,
  AdsefidClient,
  AdsefidRateLimitError,
  AdsefidValidationError,
} from "../src/index.js";

async function main(): Promise<void> {
  const apiKey = process.env.ADSEFID_API_KEY;
  if (!apiKey) {
    throw new Error("Set ADSEFID_API_KEY before running this example.");
  }

  const client = new AdsefidClient({ apiKey });

  try {
    const result = await client.sms.sendSingle({
      receptor: "98912****567",
      line_number: "983000XXX",
      message: "سلام، پیام تست",
    });

    console.log("Sent:", result.message_id, result.status);
  } catch (err) {
    if (err instanceof AdsefidValidationError) {
      // Thrown by client-side pre-flight validation, before any request was sent.
      console.error("Validation failed:", err.field, err.message);
    } else if (err instanceof AdsefidRateLimitError) {
      // MESSAGE_LIMIT_REACHED / REQUEST_LIMIT_REACHED — back off at the caller's HTTP layer.
      console.error("Rate limited:", err.codeName, err.details);
    } else if (err instanceof AdsefidApiError) {
      // Any other structured API error, e.g. DUPLICATE_LOCAL_ID or INVALID_PARAMETER.
      console.error("API error:", err.codeName, err.httpStatusCode, err.details);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
