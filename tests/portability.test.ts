import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { verifyAndParseWebhook } from "../src/webhooks/verify.js";
import { fixtureBytes, fixtureJson } from "./helpers/fixtures.js";

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const IMPORT_PATTERN = /(?:import|export)\s[^"']*?from\s+["']([^"']+)["']/g;

function importGraph(entry: string): Map<string, string> {
  const visited = new Map<string, string>();
  const pending = [resolve(SRC_DIR, entry)];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (visited.has(file)) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    visited.set(file, source);
    for (const [, specifier] of source.matchAll(IMPORT_PATTERN)) {
      if (specifier?.startsWith(".")) {
        pending.push(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
      }
    }
  }
  return visited;
}

describe("the package uses only Web-standard APIs", () => {
  const graph = importGraph("index.ts");

  it("reaches every source module from the entry point", () => {
    expect(graph.size).toBeGreaterThan(10);
  });

  it.each([...graph.keys()].map((file) => [file.slice(SRC_DIR.length + 1), file]))(
    "%s uses no Node.js built-ins",
    (_name, file) => {
      const source = (graph.get(file) as string)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(source).not.toMatch(/from\s+["']node:/);
      expect(source).not.toMatch(/\bBuffer\b/);
      expect(source).not.toMatch(/\bprocess\./);
    },
  );
});

describe("verifyAndParseWebhook body forms", () => {
  const vector = fixtureJson<{
    secret: string;
    timestamp: string;
    body_file: string;
    signature: string;
  }>("webhooks/signature_vector.json");
  const body = fixtureBytes(vector.body_file);
  const aCentury = 100 * 365 * 24 * 60 * 60;

  it.each([
    ["a Node.js Buffer", body],
    ["a Uint8Array", new Uint8Array(body)],
    ["a Uint8Array view into a larger buffer", new Uint8Array([0, ...body, 0]).subarray(1, -1)],
    ["an ArrayBuffer", Uint8Array.from(body).buffer],
    ["a string", body.toString("utf8")],
  ])("accepts the raw body as %s", async (_name, rawBody) => {
    const event = await verifyAndParseWebhook({
      rawBody,
      signatureHeader: vector.signature,
      timestampHeader: vector.timestamp,
      secret: vector.secret,
      maxAgeSeconds: aCentury,
    });

    expect(event.type).toBe("receive");
  });
});
