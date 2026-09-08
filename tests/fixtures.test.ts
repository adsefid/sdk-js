import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { FIXTURES_DIR, fixtureBytes, manifestEntries } from "./helpers/fixtures.js";

/**
 * The golden fixtures are byte-identical copies of the same tree in the sibling
 * SDK repositories. A fixture that drifts here silently weakens every test that
 * reads it, so verify the manifest rather than trusting it.
 */
describe("fixture integrity", () => {
  const entries = manifestEntries();

  it("lists something", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("$name matches its checksum", ({ sha256, name }) => {
    expect(existsSync(join(FIXTURES_DIR, name))).toBe(true);
    expect(createHash("sha256").update(fixtureBytes(name)).digest("hex")).toBe(sha256);
  });

  it("has no file missing from the manifest", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });

    const onDisk = walk(FIXTURES_DIR)
      .map((path) => relative(FIXTURES_DIR, path).split(sep).join("/"))
      .filter((name) => name !== "CHECKSUMS.txt")
      .sort();

    expect(onDisk).toEqual(entries.map((entry) => entry.name).sort());
  });
});
