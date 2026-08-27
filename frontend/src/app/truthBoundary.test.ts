import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A regression guard for the truth boundary.
 *
 * The frontend may sort, group, format, route, select and join exact identifiers.
 * It may not reconstruct a backend-owned verdict. The most likely way that rule
 * decays is a comparison against an external authority's raw value — a
 * `conclusion === "success"` added at 2am to light up a tick.
 *
 * These patterns are cheap to scan for and expensive to notice in review.
 */

const ROOT = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  {
    pattern: /conclusion\s*(===|==|!==|!=)/,
    why: "CI conclusion must never be interpreted in the client; render verification_state.",
  },
  {
    pattern: /(===|==)\s*["'](success|failure)["']/,
    why: "External authority outcomes are read from backend semantic fields, not compared.",
  },
  {
    pattern:
      /\bevery\s*\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.status\s*===\s*["']PASSED["']/,
    why: "Objective restoration is decided by the backend verifier, never by folding invariants.",
  },
  {
    pattern: /is(Restored|Verified|Recovered)\s*=\s*[^;]*\.length/,
    why: "A count of invariants or receipts must never stand in for a semantic verdict.",
  },
];

/** Modules whose whole job is rendering supplied enums may compare those enums. */
const ALLOWED_FILES = new Set([
  "components/StatusVocabulary.tsx",
  "truthBoundary.test.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "fixtures" || entry === "contract") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("truth boundary", () => {
  const files = walk(ROOT).filter(
    (file) => !ALLOWED_FILES.has(relative(ROOT, file).replace(/\\/g, "/")),
  );

  it("scans a non-trivial number of application files", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it("contains no client-side reconstruction of backend verdicts", () => {
    const offences: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      lines.forEach((line, index) => {
        if (line.trim().startsWith("*") || line.trim().startsWith("//")) return;
        for (const rule of FORBIDDEN) {
          if (rule.pattern.test(line)) {
            offences.push(
              `${relative(ROOT, file).replace(/\\/g, "/")}:${index + 1} — ${rule.why}\n    ${line.trim()}`,
            );
          }
        }
      });
    }

    expect(offences).toEqual([]);
  });

  it("keeps the generated contract out of hand-editing", () => {
    const generated = readFileSync(
      join(ROOT, "contract/uiContract.ts"),
      "utf8",
    );
    expect(generated).toContain("GENERATED FILE — DO NOT EDIT");
  });
});
