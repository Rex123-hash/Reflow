#!/usr/bin/env node
/**
 * Vendors the official brand marks Reflow needs from `simple-icons` into a small
 * typed module, so the 5 MB icon barrel stays a build-time dependency.
 *
 * simple-icons ships the vendors' own marks (CC0-1.0 for the icon data; the marks
 * themselves remain the property of their respective owners). Each generated entry
 * records the upstream source URL for attribution.
 *
 *   node scripts/generate-integration-marks.mjs
 *   node scripts/generate-integration-marks.mjs --check
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../src/app/assets/integrationMarks.ts");
const require = createRequire(import.meta.url);

/**
 * Only the external authorities Reflow actually integrates with.
 *
 * Slack is deliberately absent: simple-icons no longer ships a Slack mark, so there
 * is no official path to vendor. Rather than draw a lookalike and present it as
 * Slack's own logo, Slack is named as an external authority with a Reflow-drawn
 * channel glyph in `SourceMark`. Attribution stays correct either way, which is the
 * point of this module.
 */
const WANTED = [
  { key: "github", slug: "github" },
  { key: "google_calendar", slug: "googlecalendar" },
  { key: "gmail", slug: "gmail" },
  { key: "jira", slug: "jira" },
];

const data = JSON.parse(
  readFileSync(require.resolve("simple-icons/icons.json"), "utf8"),
);
const bySlug = new Map(
  (Array.isArray(data) ? data : data.icons).map((icon) => [
    icon.slug ?? icon.title.toLowerCase().replace(/[^a-z0-9]/g, ""),
    icon,
  ]),
);

/** icons.json carries the metadata; the geometry lives in the shipped SVG file. */
function readPath(slug) {
  const file = require.resolve(`simple-icons/icons/${slug}.svg`);
  const svg = readFileSync(file, "utf8");
  const match = svg.match(/<path\s+d="([^"]+)"/);
  if (!match) throw new Error(`no path data in simple-icons/icons/${slug}.svg`);
  return match[1];
}

const entries = WANTED.map(({ key, slug }) => {
  const icon = bySlug.get(slug);
  if (!icon) throw new Error(`simple-icons has no icon for slug "${slug}"`);
  return {
    key,
    title: icon.title,
    path: readPath(slug),
    // The vendor's own brand colour, so a mark can be drawn as the vendor draws it.
    hex: icon.hex,
    source: icon.source ?? "",
  };
});

const body = entries
  .map(
    (entry) => `  ${JSON.stringify(entry.key)}: {
    title: ${JSON.stringify(entry.title)},
    path: ${JSON.stringify(entry.path)},
    hex: ${JSON.stringify("#" + entry.hex)},
    source: ${JSON.stringify(entry.source)},
  },`,
  )
  .join("\n");

const output = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Official vendor brand marks, vendored from the \`simple-icons\` package
 * (icon data CC0-1.0; each mark remains the property of its owner).
 * Regenerate: npm run marks:generate
 *
 * These identify the EXTERNAL AUTHORITY only. Each carries the vendor's own brand
 * colour so it is drawn the way that vendor draws it — but the colour is fixed to
 * the brand and is never changed to signal success or failure. Outcome is carried
 * by Reflow's own semantic status vocabulary standing beside the mark.
 *
 * Reflow-native sources (the deterministic verifier, the policy engine, the
 * objective graph, the workflow ledger) use Reflow's own marks, never a
 * third-party logo.
 */

export interface IntegrationMark {
  title: string;
  /** 24×24 viewBox path data. */
  path: string;
  /** The vendor's official brand colour. Fixed; never state-dependent. */
  hex: string;
  source: string;
}

export const INTEGRATION_MARKS: Record<string, IntegrationMark> = {
${body}
};
`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* fall through */
  }
  if (current !== output) {
    console.error(
      "integration marks are stale — run `npm run marks:generate`.",
    );
    process.exit(1);
  }
  console.log("integration marks are up to date.");
} else {
  writeFileSync(OUT, output, "utf8");
  console.log(`wrote ${OUT} (${entries.map((e) => e.title).join(", ")})`);
}
