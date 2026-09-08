import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

/**
 * Reads one fixture as raw bytes. Webhook verification signs the exact bytes on
 * the wire, so anything feeding a signature must go through here rather than
 * re-serializing JSON.
 */
export function fixtureBytes(name: string): Buffer {
  return readFileSync(join(FIXTURES_DIR, name));
}

export function fixtureText(name: string): string {
  return fixtureBytes(name).toString("utf8");
}

export function fixtureJson<T = unknown>(name: string): T {
  return JSON.parse(fixtureText(name)) as T;
}

export function manifestEntries(): Array<{ sha256: string; name: string }> {
  return fixtureText("CHECKSUMS.txt")
    .trim()
    .split("\n")
    .map((line) => {
      const [sha256, name] = line.split("  ");
      return { sha256: sha256 as string, name: name as string };
    });
}

export { FIXTURES_DIR };
