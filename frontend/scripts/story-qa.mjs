#!/usr/bin/env node
/**
 * Bounded visual QA for the recovery story. Proof tooling, not product code.
 *
 * This replaces a harness that reloaded the Three.js page once per progress
 * sample — 201 loads, each waiting on a WebGL first frame. It ran for a very long
 * time and had to be stopped by hand. The point of story QA is to catch visible
 * regressions, not to exhaust the timeline, so this one:
 *
 *   uses ONE initialised page per run;
 *   inspects only the ten settled story states, not every percent;
 *   seeks by *measuring* `--story-progress` rather than assuming a scroll formula;
 *   drives real wheel scrolling in a few short passes, sampling every fifth tick.
 *
 *   node scripts/story-qa.mjs rail 1920 1080   # rail geometry at each beat frame
 *   node scripts/story-qa.mjs states 1920 1080 # the ten settled states
 *   node scripts/story-qa.mjs scroll           # forward, fast and reverse wheel
 */
import { chromium } from "playwright-core";

const CH =
  process.env.REFLOW_CHROMIUM ??
  "C:/Users/OMEN/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const B = process.env.REFLOW_PREVIEW_URL ?? "http://127.0.0.1:4174";
const MODE = process.argv[2] ?? "states";
const W = Number(process.argv[3] || 1920);
const H = Number(process.argv[4] || 1080);

/**
 * Midpoint of each story state's settled plateau, derived from the schedule in
 * src/data/storySchedule.ts (total 268 units). Kept here as explicit constants so
 * the QA asserts against an independently written expectation rather than reading
 * the same module the product reads.
 */
const SETTLED = [
  { at: 0.0336, rail: "Objective protected", kicker: "Objective", beat: "hero" },
  { at: 0.1604, rail: "Disruption and impact", kicker: "Detect", beat: "risk" },
  { at: 0.291, rail: "Recovery futures", kicker: "Plan", beat: "futures" },
  { at: 0.4104, rail: "Real action", kicker: "Act", beat: "action" },
  { at: 0.4851, rail: "Independent verification", kicker: "Verify", beat: "action" },
  {
    at: 0.5896,
    rail: "Recovery incomplete",
    kicker: "Verify · Outcome",
    beat: "incomplete",
  },
  { at: 0.7015, rail: "Replanning", kicker: "Plan · Attempt 2", beat: "replan" },
  { at: 0.7593, rail: "New action", kicker: "Act · Attempt 2", beat: "replan" },
  { at: 0.8116, rail: "Verify again", kicker: "Verify · Attempt 2", beat: "replan" },
  { at: 0.9328, rail: "Restored", kicker: "Outcome", beat: "restored" },
];

const FRAMES = [
  "hero",
  "risk",
  "futures",
  "action",
  "incomplete",
  "replan",
  "restored",
];

const FLAGS = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
];

/** Everything one check needs, read in a single evaluate. */
const PROBE = () => {
  const root = document.querySelector(".recovery-story");
  const progress = Number(
    getComputedStyle(root).getPropertyValue("--story-progress") || 0,
  );

  const beats = [...document.querySelectorAll("[data-beat]")].map((el) => ({
    id: el.dataset.beat,
    o: Number(getComputedStyle(el).opacity),
    v: getComputedStyle(el).visibility,
    el,
  }));
  const live = beats.filter((b) => b.v !== "hidden" && b.o > 0.12);

  const region = (el) => {
    const parts = [...el.children]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 60 && r.height > 24);
    if (!parts.length) return null;
    return {
      l: Math.min(...parts.map((r) => r.left)),
      r: Math.max(...parts.map((r) => r.right)),
      t: Math.min(...parts.map((r) => r.top)),
      b: Math.max(...parts.map((r) => r.bottom)),
    };
  };

  let textCollisions = 0;
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = region(live[i].el);
      const b = region(live[j].el);
      if (
        a &&
        b &&
        Math.min(a.r, b.r) > Math.max(a.l, b.l) &&
        Math.min(a.b, b.b) > Math.max(a.t, b.t)
      )
        textCollisions += 1;
    }
  }

  const rail = document.querySelector(".story-progress");
  const railShown = rail && getComputedStyle(rail).display !== "none";
  let railCollisions = 0;
  let clipped = 0;
  let active = null;
  let kicker = null;
  if (railShown) {
    const rb = rail.getBoundingClientRect();
    const candidates = [
      ...live.flatMap((b) => [...b.el.querySelectorAll("*")]),
      ...document.querySelectorAll(".orbital-rail-system text"),
    ];
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 8) continue;
      if (Number(getComputedStyle(el).opacity) < 0.15) continue;
      if (r.right > rb.left && r.left < rb.right && r.bottom > rb.top && r.top < rb.bottom)
        railCollisions += 1;
    }
    for (const t of rail.querySelectorAll(".rail-name, .rail-phase")) {
      const r = t.getBoundingClientRect();
      if (r.right > window.innerWidth - 1 || r.left < 0) clipped += 1;
    }
    const row = rail.querySelector('[data-rail-state="active"]');
    active = row?.querySelector(".rail-name")?.textContent ?? null;
    kicker = row?.querySelector(".rail-phase")?.textContent ?? null;
  }

  return {
    progress,
    live: live.map((b) => `${b.id}:${b.o.toFixed(2)}`),
    dominant: live.filter((b) => b.o > 0.9).map((b) => b.id),
    textCollisions,
    railCollisions,
    clipped,
    active,
    kicker,
    railShown: Boolean(railShown),
    overflow:
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
};

/**
 * Parks the timeline at an exact progress via the product's own capture mode.
 *
 * Scrolling to a target is not usable for this check: ScrollTrigger runs with
 * scrub 0.42 and, under SwiftShader, the scrub takes far longer than its nominal
 * catch-up, so a measured seek converges on the wrong place. `?progress=` sets the
 * timeline deterministically with no scrub, which is what it exists for. Ten
 * targeted loads — one per story state — not a sweep.
 */
async function parkAt(page, target) {
  await page.goto(`${B}/?progress=${target.toFixed(4)}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .waitForFunction(
      () => Boolean(document.documentElement.dataset.storyFirstFrameMs),
      undefined,
      { timeout: 120000, polling: 100 },
    )
    .catch(() => {});
  await page.waitForTimeout(400);
  return page.evaluate(PROBE);
}

const browser = await chromium.launch({
  executablePath: CH,
  headless: true,
  args: FLAGS,
});

if (MODE === "rail") {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  for (const frame of FRAMES) {
    await page.goto(`${B}/?frame=${frame}`, { waitUntil: "domcontentloaded" });
    await page
      .waitForFunction(
        () => Boolean(document.documentElement.dataset.storyFirstFrameMs),
        undefined,
        { timeout: 120000, polling: 100 },
      )
      .catch(() => {});
    await page.waitForTimeout(350);
    const r = await page.evaluate(PROBE);
    console.log(
      `${W} ${frame.padEnd(11)} rail=${r.railShown ? "shown" : "hidden"} ` +
        `active="${r.active ?? "-"}" clipped=${r.clipped} ` +
        `railHits=${r.railCollisions} textCollisions=${r.textCollisions} ` +
        `overflow=${r.overflow}px`,
    );
  }
} else if (MODE === "states") {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  let failures = 0;
  for (const want of SETTLED) {
    const r = await parkAt(page, want.at);
    const railOk = !r.railShown || r.active === want.rail;
    const kickerOk = !r.railShown || r.kicker === want.kicker;
    const dominantOk = r.dominant.length === 1 && r.dominant[0] === want.beat;
    const clean =
      railOk &&
      kickerOk &&
      dominantOk &&
      r.textCollisions === 0 &&
      r.railCollisions === 0 &&
      r.clipped === 0 &&
      r.overflow === 0;
    if (!clean) failures += 1;
    console.log(
      `${clean ? "PASS" : "FAIL"} ${want.rail.padEnd(24)} ` +
        `p=${r.progress.toFixed(3)} dominant=[${r.dominant.join(",")}] ` +
        `rail="${r.active}" kicker="${r.kicker}" ` +
        `textCol=${r.textCollisions} railCol=${r.railCollisions} ` +
        `clipped=${r.clipped} overflow=${r.overflow}px`,
    );
  }
  console.log(`\n${W}x${H}: ${SETTLED.length - failures}/${SETTLED.length} settled states clean`);
} else {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  await page.goto(B, { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(
      () => Boolean(document.documentElement.dataset.storyFirstFrameMs),
      undefined,
      { timeout: 120000, polling: 100 },
    )
    .catch(() => {});
  await page.waitForTimeout(500);

  for (const [name, delta, ticks, pause] of [
    ["slow wheel", 140, 30, 50],
    ["normal wheel", 340, 20, 40],
    ["fast/trackpad", 900, 12, 30],
  ]) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    let collisions = 0;
    let sampled = 0;
    let max = 0;
    for (let t = 0; t < ticks; t += 1) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(pause);
      if (t % 5 === 0) {
        const r = await page.evaluate(PROBE);
        sampled += 1;
        if (r.textCollisions || r.railCollisions) collisions += 1;
        max = Math.max(max, r.progress);
      }
    }
    await page.waitForTimeout(1300);
    const s = await page.evaluate(PROBE);
    console.log(
      `${name.padEnd(14)} ticks=${ticks} sampled=${sampled} ` +
        `collidingSamples=${collisions} maxProgress=${max.toFixed(3)} ` +
        `settled=[${s.live.join(" ")}] rail="${s.active}" overflow=${s.overflow}px`,
    );
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1300);
  let rc = 0;
  let rs = 0;
  for (let t = 0; t < 30; t += 1) {
    await page.mouse.wheel(0, -420);
    await page.waitForTimeout(40);
    if (t % 5 === 0) {
      const r = await page.evaluate(PROBE);
      rs += 1;
      if (r.textCollisions || r.railCollisions) rc += 1;
    }
  }
  await page.waitForTimeout(1300);
  const r = await page.evaluate(PROBE);
  console.log(
    `reverse        ticks=30 sampled=${rs} collidingSamples=${rc} ` +
      `settled=[${r.live.join(" ")}] rail="${r.active}" overflow=${r.overflow}px`,
  );
}

await browser.close();
