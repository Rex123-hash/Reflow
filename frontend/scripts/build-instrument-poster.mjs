#!/usr/bin/env node
/**
 * Converts the Blender poster render into the web assets the hero ships.
 *
 * The render itself is produced by
 * `orb-authored-experiment/render_instrument_poster.py`, which reproduces the
 * browser's hero camera and transform. This step only resizes and encodes.
 *
 *   node scripts/build-instrument-poster.mjs
 *   node scripts/build-instrument-poster.mjs --check
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(
  here,
  "../orb-authored-experiment/poster-v1/reflow-instrument-poster.png",
);
const DEST_DIR = resolve(here, "../src/assets/instrument");
const WIDTH = 1600;

const PY = `
import sys
from PIL import Image

source, dest_dir, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
image = Image.open(source).convert("RGBA")
if image.width > width:
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.LANCZOS)

image.save(dest_dir + "/reflow-instrument-poster.webp", "WEBP", quality=82, method=6)
print("webp ok")
try:
    image.save(dest_dir + "/reflow-instrument-poster.avif", "AVIF", quality=58)
    print("avif ok")
except Exception as error:
    print("avif skipped:", error)
`;

if (!existsSync(SOURCE)) {
  console.error(
    `missing ${SOURCE}\nRun: & 'D:\\\\blender.exe' --background --python orb-authored-experiment/render_instrument_poster.py`,
  );
  process.exit(1);
}

const outputs = [
  "reflow-instrument-poster.webp",
  "reflow-instrument-poster.avif",
].map((name) => join(DEST_DIR, name));

if (process.argv.includes("--check")) {
  const missing = outputs.filter((file) => !existsSync(file));
  if (missing.length) {
    console.error(
      `poster assets missing: ${missing.join(", ")} — run \`npm run poster:build\`.`,
    );
    process.exit(1);
  }
  console.log("poster assets present.");
  process.exit(0);
}

const result = execFileSync(
  "python",
  ["-c", PY, SOURCE, DEST_DIR, String(WIDTH)],
  {
    encoding: "utf8",
  },
);
process.stdout.write(result);

for (const file of outputs) {
  if (!existsSync(file)) continue;
  console.log(
    `${file.split(/[\\/]/).pop()} — ${(statSync(file).size / 1024).toFixed(1)} kB`,
  );
}
