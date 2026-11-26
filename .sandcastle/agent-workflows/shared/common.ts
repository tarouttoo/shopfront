import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as sandcastle from "@ai-hero/sandcastle";

export const outputDir = (): string => process.env.OUTPUT_DIR ?? "/tmp";

export const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
};

export const fail = (message: string): never => {
  console.error(`\nFAILED: ${message}`);
  fs.mkdirSync(outputDir(), { recursive: true });
  fs.writeFileSync(path.join(outputDir(), "failure_reason.txt"), message);
  process.exit(1);
};

// capture buffer: execSync's 1 MiB default overflows on whole-PR diffs
// (PR #12 review died twice with `spawnSync /bin/sh ENOBUFS` on a 4 MB diff)
const MAX_CAPTURE = 64 * 1024 * 1024;

const humanizeBytes = (bytes: number): string => {
  const gib = bytes / 1024 ** 3;
  const mib = bytes / 1024 ** 2;
  const kib = bytes / 1024;
  if (gib >= 1) return `${Number.isInteger(gib) ? gib : gib.toFixed(1)} GiB`;
  if (mib >= 1) return `${Number.isInteger(mib) ? mib : mib.toFixed(1)} MiB`;
  if (kib >= 1) return `${Number.isInteger(kib) ? kib : kib.toFixed(1)} KiB`;
  return `${bytes} bytes`;
};

/**
 * Forensic wrapper for capture failures. A maxBuffer overflow's own error
 * is the bare `spawnSync /bin/sh ENOBUFS` — no command, no counts — so this
 * wrapper is the only surface naming the command, the capture limit, and
 * how much the killed child had captured (always past the limit; that
 * overflow is why it was killed).
 */
const captureError = (cmd: string, error: unknown): Error => {
  if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOBUFS") {
    const captured = (error as { stdout?: string }).stdout;
    const bytes =
      typeof captured === "string" ? Buffer.byteLength(captured) : MAX_CAPTURE;
    return new Error(
      `"${cmd}" overflowed ${humanizeBytes(MAX_CAPTURE)} maxBuffer after ${bytes} bytes`,
    );
  }
  return error instanceof Error ? error : new Error(String(error));
};

export const sh = (cmd: string): string => {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: MAX_CAPTURE,
    });
  } catch (error) {
    throw captureError(cmd, error);
  }
};

export const safeSh = (cmd: string): string => {
  try {
    return sh(cmd);
  } catch {
    return "";
  }
};

export const gh = (args: string[]): string => {
  // Forensic command line: collapse the GraphQL query's newlines so the
  // wrapped error stays one greppable line in a «Reason:» comment.
  const cmd = ["gh", ...args].join(" ").replace(/\s+/g, " ");
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: MAX_CAPTURE,
    });
  } catch (error) {
    throw captureError(cmd, error);
  }
};

/** Append a markdown line to the workflow run's step summary. */
export const appendSummary = (markdown: string): void => {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) {
    fs.appendFileSync(file, markdown);
  } else {
    process.stdout.write(markdown);
  }
};

export const writeJson = (filename: string, value: unknown): void => {
  fs.mkdirSync(outputDir(), { recursive: true });
  fs.writeFileSync(
    path.join(outputDir(), filename),
    JSON.stringify(value, null, 2),
  );
};

export const writeText = (filename: string, value: string): void => {
  fs.mkdirSync(outputDir(), { recursive: true });
  fs.writeFileSync(path.join(outputDir(), filename), value);
};

/**
 * The workflow's coding agent: pi CLI over the provider/model named by the
 * workflow's env vars (`AGENT_PROVIDER`/`AGENT_MODEL`, e.g. `zai` +
 * `glm-5.3-flash`), authenticated via the `ZAI_API_KEY` secret.
 */
export const agentFromEnv = () =>
  sandcastle.pi(`${required("AGENT_PROVIDER")}/${required("AGENT_MODEL")}`, {
    env: { ZAI_API_KEY: required("ZAI_API_KEY") },
  });

export const standardSchema = <T>(
  validate: (value: unknown) => T,
): StandardSchemaV1<unknown, T> => ({
  "~standard": {
    version: 1,
    vendor: "sandcastle-agent-workflows",
    validate: (value: unknown) => {
      try {
        return { value: validate(value) };
      } catch (error) {
        return {
          issues: [
            {
              message:
                error instanceof Error ? error.message : "Validation failed",
            },
          ],
        };
      }
    },
  },
});

export const asRecord = (
  value: unknown,
  label: string,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const asString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
};

export const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

export const asArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
};
