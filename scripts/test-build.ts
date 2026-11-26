import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

/**
 * Vitest globalSetup: build the static site once into dist/ before any
 * test file runs, and have every built-output suite (landing, base
 * layout, category pages, services, privacy, order FAQ, indexability)
 * read that same tree. Before this setup each suite execed its own
 * build into the shared dist/ — seven serial builds per `npm test`,
 * racing the tree mid-prerender (measured flake ~1 in 4 full runs).
 *
 * The freshness check is cross-process: a stamp file inside dist/
 * carries the completion time, and a rebuild happens only when some
 * build input is newer than the stamp. Any later process re-verifies it
 * the same way. A plain `npm run build` shares this outDir and empties
 * dist/, destroying the stamp — so it always forces the next test run
 * to rebuild. Safe direction on doubt: rebuild.
 */

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const STAMP_PATH = path.join(ROOT, "dist", ".test-build-stamp");

/** Build inputs: everything the Astro build reads (catalog.json is the
 * committed feeder output; scripts/build-catalog.ts runs by hand, never
 * inside the build). */
const INPUT_DIRS = ["src", "public"];
const INPUT_FILES = ["astro.config.mjs", "package.json"];

const newestMtime = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce<number>((max, entry) => {
    const full = path.join(dir, entry.name);
    const mtime = entry.isDirectory() ? newestMtime(full) : statSync(full).mtimeMs;
    return Math.max(max, mtime);
  }, 0);

const distIsFresh = (): boolean => {
  if (!existsSync(STAMP_PATH)) return false;
  const inputs = [
    ...INPUT_DIRS.map((dir) => newestMtime(path.join(ROOT, dir))),
    ...INPUT_FILES.map((file) => statSync(path.join(ROOT, file)).mtimeMs),
  ];
  return statSync(STAMP_PATH).mtimeMs > Math.max(...inputs);
};

export default function buildOnceForTests(): void {
  if (distIsFresh()) {
    console.log("[test-build] dist/ is fresh — all suites read the shared build");
    return;
  }
  console.log("[test-build] building dist/ once for every built-output suite…");
  const env = { ...process.env };
  // Vitest exports BASE_URL=/ into the environment; an inherited value
  // would override the configured /shopfront base in the child build.
  // Build with the environment a real `npm run build` has — no BASE_URL.
  delete env.BASE_URL;
  execSync("npx astro build", { cwd: ROOT, stdio: "inherit", env });
  writeFileSync(STAMP_PATH, `${new Date().toISOString()}\n`);
}
