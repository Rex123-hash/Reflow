#!/usr/bin/env node
/**
 * Copies the backend-exported presentation fixtures into the frontend tree.
 *
 * `docs/ui-fixtures/` is owned by the backend and exported through the real
 * PresentationService. The frontend never reaches across the repo boundary at
 * build time; it consumes a copy so the dependency is explicit and reviewable.
 *
 *   node scripts/sync-fixtures.mjs           # copy
 *   node scripts/sync-fixtures.mjs --check   # fail if the copies are stale
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../../docs/ui-fixtures");
const DEST = resolve(here, "../src/app/data/fixtures");

const check = process.argv.includes("--check");
mkdirSync(DEST, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith(".json"));
let stale = [];

for (const file of files) {
  const source = readFileSync(join(SRC, file), "utf8");
  const target = join(DEST, file);
  let current = null;
  try {
    current = readFileSync(target, "utf8");
  } catch {
    /* missing copy counts as stale */
  }
  if (current === source) continue;
  if (check) {
    stale.push(file);
  } else {
    writeFileSync(target, source, "utf8");
  }
}

if (check) {
  if (stale.length) {
    console.error(
      `fixtures are stale (${stale.join(", ")}) — run \`npm run fixtures:sync\`.`,
    );
    process.exit(1);
  }
  console.log(`fixtures are up to date (${files.length} files).`);
} else {
  console.log(`synced ${files.length} fixtures into src/app/data/fixtures`);
}
