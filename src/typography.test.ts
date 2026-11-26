import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

// GLOSSARY.md Typography: Russian UI text quotes with «…»; inside an
// outer «…» quote the inner quote uses „…“. A second opening mark before
// the outer one closes is nested quoting — restructure or use „…“.
// The scan is line-scoped: real UI nesting lives within one string.

const EXTENSIONS = [".astro", ".tsx", ".ts", ".json"];

const collect = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
};

const SRC = fileURLToPath(new URL("./", import.meta.url));

describe("Russian UI typography (GLOSSARY.md)", () => {
  it("flags a nested opening quote mark on one line", () => {
    const offenders: string[] = [];
    for (const file of collect(SRC)) {
      const relative = path.relative(SRC, file);
      const text = readFileSync(file, "utf8");
      for (const [index, line] of text.split("\n").entries()) {
        const match = line.match(/«[^»]*«/);
        if (match) {
          offenders.push(`${relative}:${index + 1}: ${match[0].slice(0, 60)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
