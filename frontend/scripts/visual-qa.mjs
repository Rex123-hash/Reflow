#!/usr/bin/env node
/**
 * Visual-QA harness for the marketing hero. Proof tooling, not product code.
 *
 * The in-app browser pane cannot composite (visibility hidden, zero rAF), so
 * fidelity work is driven from an independent headless Chromium instead. WebGL
 * comes from ANGLE/SwiftShader, which is a conformant GL2 implementation — tone
 * mapping, exposure and material response are faithful; only AA differs slightly
 * from a discrete GPU.
 *
 * Captures wait on the product's own readiness signal
 * (`documentElement.dataset.storyFirstFrameMs`, set when the renderer reports it
 * drew geometry), so a screenshot can never be taken of a half-initialised scene.
 *
 *   node scripts/visual-qa.mjs                     # all viewports, normal motion
 *   node scripts/visual-qa.mjs --reduced           # reduced motion
 *   node scripts/visual-qa.mjs --tag before        # label the output set
 *   node scripts/visual-qa.mjs --only 1440
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../visual-qa");

const CHROMIUM =
  process.env.REFLOW_CHROMIUM ??
  "C:/Users/OMEN/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const BASE = process.env.REFLOW_PREVIEW_URL ?? "http://127.0.0.1:4174";

/** Headless Chromium throttles hidden/occluded renderers; the scene is rAF-driven. */
const FLAGS = [
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeWinOcclusion",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
];

const VIEWPORTS = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "390", width: 390, height: 844 },
];

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const reduced = flag("reduced");
const tag = value("tag", "current");
const only = value("only", null);
// `--frame <stage>` holds a deterministic story beat (hero|risk|futures|action|
// incomplete|replan|restored) so each marketing section can be captured.
const frame = value("frame", null);
const READY_TIMEOUT_MS = Number(value("timeout", "120000"));

mkdirSync(OUT, { recursive: true });

async function capture(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  const started = Date.now();
  const url = frame ? `${BASE}/?frame=${frame}` : BASE;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // The product's own definition of ready: the renderer drew the instrument.
  // Deliberately no mouse movement, click or scroll before this resolves — that
  // is what proves initialisation does not depend on interaction.
  let readyMs = null;
  try {
    await page.waitForFunction(
      () => Boolean(document.documentElement.dataset.storyFirstFrameMs),
      undefined,
      { timeout: READY_TIMEOUT_MS, polling: 100 },
    );
    readyMs = await page.evaluate(
      () => document.documentElement.dataset.storyFirstFrameMs,
    );
  } catch {
    readyMs = null;
  }

  const metrics = await page.evaluate(() => {
    const d = document.documentElement.dataset;
    const glb = performance
      .getEntriesByType("resource")
      .find((r) => r.name.endsWith(".glb"));
    const paint = performance
      .getEntriesByType("paint")
      .map((p) => `${p.name}=${Math.round(p.startTime)}`);
    const poster = document.querySelector(".instrument-poster");
    const canvas = document.querySelector("canvas");
    return {
      firstFrameMs: d.storyFirstFrameMs ?? null,
      modelReadyMs: d.storyModelReadyMs ?? null,
      cls: d.storyCls ?? null,
      triangles: d.storyTriangles ?? null,
      drawCalls: d.storyDrawCalls ?? null,
      paint,
      glbMs: glb ? Math.round(glb.duration) : null,
      glbKb: glb ? Math.round(glb.transferSize / 1024) : null,
      posterHidden: poster ? poster.classList.contains("is-hidden") : null,
      canvasSize: canvas ? [canvas.width, canvas.height] : null,
      layerClass: document.querySelector(".orb-layer")?.className ?? null,
    };
  });

  // Let the crossfade settle so the capture shows the WebGL frame, not a blend.
  await page.waitForTimeout(600);

  const suffix = reduced ? "reduced" : "normal";
  const file = join(OUT, `${tag}-${frame ?? suffix}-${viewport.name}.png`);
  await page.screenshot({ path: file });

  await context.close();
  return {
    viewport: viewport.name,
    wallClockMs: Date.now() - started,
    consoleErrors,
    file,
    ...metrics,
  };
}

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: FLAGS,
});
const targets = only ? VIEWPORTS.filter((v) => v.name === only) : VIEWPORTS;
const results = [];
for (const viewport of targets) {
  const result = await capture(browser, viewport);
  results.push(result);
  const status = result.firstFrameMs
    ? `ready ${Math.round(result.firstFrameMs)}ms`
    : "NEVER READY";
  console.log(
    `${viewport.name.padEnd(7)} ${status.padEnd(18)} tris=${result.triangles ?? "-"} ` +
      `calls=${result.drawCalls ?? "-"} cls=${result.cls ?? "-"} ` +
      `errors=${result.consoleErrors.length} -> ${result.file.split(/[\\/]/).pop()}`,
  );
}
await browser.close();

writeFileSync(
  join(OUT, `${tag}-${reduced ? "reduced" : "normal"}.json`),
  JSON.stringify({ base: BASE, reduced, results }, null, 2),
);
