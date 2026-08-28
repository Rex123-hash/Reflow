#!/usr/bin/env node
/**
 * Proves whether the hero actually animates, with zero user interaction.
 *
 * Pixel comparison rather than internal state: the satellites and the idle bob
 * live inside the R3F scene graph, so the only honest end-to-end proof that
 * "animation is running" is that successive frames differ on screen.
 *
 * Also samples rAF activity and the renderer's own frame counters.
 *
 *   node scripts/motion-check.mjs
 *   node scripts/motion-check.mjs --reduced
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../visual-qa");
mkdirSync(OUT, { recursive: true });

const CHROMIUM =
  process.env.REFLOW_CHROMIUM ??
  "C:/Users/OMEN/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = process.env.REFLOW_PREVIEW_URL ?? "http://127.0.0.1:4174";
const reduced = process.argv.includes("--reduced");

const FLAGS = [
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeWinOcclusion",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
];

/** Fraction of bytes differing between two PNG buffers of equal geometry. */
function differingFraction(a, b) {
  if (a.length !== b.length) return 1;
  let differing = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) differing += 1;
  return differing / a.length;
}

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: FLAGS,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: reduced ? "reduce" : "no-preference",
});
const page = await context.newPage();

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => Boolean(document.documentElement.dataset.storyFirstFrameMs),
  undefined,
  { timeout: 120000, polling: 100 },
);

// The poster crossfade runs for 220ms after readiness. Sampling before it settles
// would register the fade as "animation" and mask whether the scene itself moves.
await page.waitForTimeout(900);

// Start rAF instrumentation only after readiness so the count reflects steady state.
await page.evaluate(() => {
  window.__rafTicks = 0;
  const loop = () => {
    window.__rafTicks += 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});

// Full viewport: in normal motion the instrument sits at the bottom of the hero,
// in reduced motion it is centred. Guessing a crop region hides real motion.
const clip = { x: 0, y: 0, width: 1440, height: 900 };
const samples = [];
let previous = null;

for (const delayMs of [0, 500, 1000, 1500, 3000]) {
  if (delayMs)
    await page.waitForTimeout(
      delayMs === 500
        ? 500
        : delayMs === 1000
          ? 500
          : delayMs === 1500
            ? 500
            : 1500,
    );
  const shot = await page.screenshot({ clip });
  const state = await page.evaluate(() => {
    const d = document.documentElement.dataset;
    return {
      rafTicks: window.__rafTicks,
      avgFrameMs: d.storyAverageMs ?? null,
      framesOver16: d.storyFramesOver16 ?? null,
      drawCalls: d.storyDrawCalls ?? null,
      motion:
        document.querySelector(".recovery-story")?.dataset.motion ?? "normal",
    };
  });
  samples.push({
    atMs: delayMs,
    ...state,
    changedVsPrevious: previous
      ? Number(differingFraction(previous, shot).toFixed(5))
      : null,
  });
  previous = shot;
  if (delayMs === 0 || delayMs === 3000) {
    writeFileSync(
      join(OUT, `motion-${reduced ? "reduced" : "normal"}-t${delayMs}.png`),
      shot,
    );
  }
}

await browser.close();

const changes = samples.slice(1).map((s) => s.changedVsPrevious);
const animating = changes.some((c) => c > 0.001);
const verdict = reduced
  ? animating
    ? "FAIL: reduced motion is still animating"
    : "PASS: reduced motion is static"
  : animating
    ? "PASS: normal motion is animating without interaction"
    : "FAIL: normal motion is STATIC without interaction";

console.log(
  `mode=${reduced ? "reduced" : "normal"}  rafTicks=${samples.at(-1).rafTicks}`,
);
for (const s of samples) {
  console.log(
    `  t+${String(s.atMs).padStart(4)}ms  changed=${s.changedVsPrevious ?? "-"}  ` +
      `raf=${s.rafTicks}  avgFrameMs=${s.avgFrameMs ?? "-"}`,
  );
}
console.log(verdict);
writeFileSync(
  join(OUT, `motion-${reduced ? "reduced" : "normal"}.json`),
  JSON.stringify({ reduced, verdict, samples }, null, 2),
);
process.exitCode = verdict.startsWith("FAIL") ? 1 : 0;
