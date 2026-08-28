#!/usr/bin/env node
/**
 * Captures the loading poster from the live WebGL frame itself.
 *
 * The poster's whole job is to be indistinguishable from the first real frame.
 * A Cycles render can only approximate that — it drifts every time tone mapping,
 * materials, lighting or satellite geometry change, and it drifted exactly that
 * way after the Phase 2 fidelity pass.
 *
 * Rendering it from the browser makes parity exact by construction: same
 * geometry, same materials, same tone mapping, same lights, same satellite
 * phases, same camera. All six parity dimensions collapse to identity.
 *
 * The Blender pipeline is still the authored source of the instrument itself;
 * this only replaces the poster's final encode step.
 *
 *   node scripts/capture-poster.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_PNG = resolve(
  here,
  "../orb-authored-experiment/poster-v1/reflow-instrument-poster.png",
);
mkdirSync(dirname(OUT_PNG), { recursive: true });

const CHROMIUM =
  process.env.REFLOW_CHROMIUM ??
  "C:/Users/OMEN/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = process.env.REFLOW_PREVIEW_URL ?? "http://127.0.0.1:4174";

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--disable-features=CalculateNativeWinOcclusion",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});

// 2x so the poster stays crisp on retina; the encoder downsamples afterwards.
// 1440x900 is the reference desktop aspect, and the poster is sized by height in
// CSS, so this framing stays correct at every viewport width.
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "no-preference",
});
const page = await context.newPage();

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => Boolean(document.documentElement.dataset.storyFirstFrameMs),
  undefined,
  { timeout: 120000, polling: 100 },
);
// Let shader compilation and the environment fully settle before capturing.
await page.waitForTimeout(1500);

// Strip the page down to the WebGL canvas on a transparent ground. The orbital
// rails and labels are story-driven overlays that animate with scroll, so they
// are excluded — the poster is the instrument, not a frozen story frame.
await page.addStyleTag({
  content: `
    html, body, .site-shell, .recovery-story, .story-track, .sticky-stage,
    .orb-layer { background: transparent !important; }
    .site-header, .story-beats, .story-beat, .story-progress,
    .production-story-rails, .story-topology, .instrument-poster,
    .three-futures-route, .action-proof-route, .replan-route, .restored-route,
    .trust-section, .final-cta { opacity: 0 !important; visibility: hidden !important; }
    .production-instrument-layer::before { display: none !important; }
    .orb-canvas { opacity: 1 !important; }
  `,
});
await page.waitForTimeout(400);

await page.screenshot({ path: OUT_PNG, omitBackground: true });
await browser.close();
console.log(`[poster] captured live WebGL frame -> ${OUT_PNG}`);
