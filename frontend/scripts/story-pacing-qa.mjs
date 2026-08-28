#!/usr/bin/env node
/**
 * Pacing proof for the recovery story. Proof tooling, not product code.
 *
 * Two questions, neither of which a screenshot can answer:
 *
 *   1. Does any pair of major narrative blocks become materially readable in the
 *      same region at the same time? Swept deterministically across the whole
 *      timeline via `?progress=`.
 *
 *   2. Does the story behave under a real wheel, at several speeds and in reverse —
 *      rather than only when a progress number is injected?
 *
 * A beat counts as "materially readable" above 0.12 opacity, which is the point at
 * which its serif headline is legible against the ivory ground.
 *
 *   node scripts/story-pacing-qa.mjs sweep
 *   node scripts/story-pacing-qa.mjs scroll
 */
import { writeFileSync, mkdirSync } from "node:fs";
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
const FLAGS = [
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeWinOcclusion",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
];

const READABLE = 0.12;
const mode = process.argv[2] ?? "sweep";
const width = Number(process.argv[3] ?? 1920);
const height = Number(process.argv[4] ?? 1080);

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: FLAGS,
});

/** Opacity and box of every beat, plus the phase rail, at the current moment. */
const PROBE = (readable) => {
  const beats = [...document.querySelectorAll("[data-beat]")].map((el) => {
    const box = el.getBoundingClientRect();
    // The beat wrapper is full-bleed; the readable region is its actual content.
    const parts = [...el.children]
      .map((child) => child.getBoundingClientRect())
      .filter((b) => b.width > 60 && b.height > 24);
    const region = parts.length
      ? {
          left: Math.min(...parts.map((b) => b.left)),
          right: Math.max(...parts.map((b) => b.right)),
          top: Math.min(...parts.map((b) => b.top)),
          bottom: Math.max(...parts.map((b) => b.bottom)),
        }
      : { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    return {
      id: el.dataset.beat,
      opacity: Number(getComputedStyle(el).opacity),
      visibility: getComputedStyle(el).visibility,
      region,
    };
  });
  const live = beats.filter(
    (b) => b.visibility !== "hidden" && b.opacity > readable,
  );
  const collisions = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i].region;
      const b = live[j].region;
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 0 && overlapY > 0) {
        collisions.push({
          a: live[i].id,
          b: live[j].id,
          aOpacity: Number(live[i].opacity.toFixed(3)),
          bOpacity: Number(live[j].opacity.toFixed(3)),
          area: Math.round(overlapX * overlapY),
        });
      }
    }
  }
  const rail = document.querySelector(".story-progress");
  const railBox = rail ? rail.getBoundingClientRect() : null;
  let railCollisions = 0;
  if (railBox && rail && getComputedStyle(rail).display !== "none") {
    for (const beat of live) {
      const el = document.querySelector(`[data-beat='${beat.id}']`);
      for (const node of el.querySelectorAll("*")) {
        const b = node.getBoundingClientRect();
        if (b.width < 40 || b.height < 14) continue;
        if (Number(getComputedStyle(node).opacity) < 0.15) continue;
        if (
          b.right > railBox.left &&
          b.left < railBox.right &&
          b.bottom > railBox.top &&
          b.top < railBox.bottom
        ) {
          railCollisions += 1;
          break;
        }
      }
    }
  }
  return {
    progress: Number(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--story-progress",
      ) || 0,
    ),
    live: live.map((b) => `${b.id}:${b.opacity.toFixed(2)}`),
    collisions,
    railCollisions,
  };
};

async function sweep() {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const samples = [];
  let worst = null;

  for (let step = 0; step <= 200; step += 1) {
    const progress = step / 200;
    await page.goto(`${BASE}/?progress=${progress.toFixed(4)}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForFunction(
        () => Boolean(document.documentElement.dataset.storyFirstFrameMs),
        undefined,
        { timeout: 120000, polling: 80 },
      )
      .catch(() => {});
    await page.waitForTimeout(60);
    const probe = await page.evaluate(PROBE, READABLE);
    samples.push({ progress, ...probe });
    if (probe.collisions.length) {
      const area = Math.max(...probe.collisions.map((c) => c.area));
      if (!worst || area > worst.area)
        worst = { progress, area, detail: probe.collisions };
    }
    if (step % 20 === 0)
      console.log(
        `  ${progress.toFixed(3)}  live=[${probe.live.join(" ")}]  ` +
          `collisions=${probe.collisions.length} railHits=${probe.railCollisions}`,
      );
  }

  const colliding = samples.filter((s) => s.collisions.length);
  const railHits = samples.filter((s) => s.railCollisions > 0);
  console.log("");
  console.log(`samples                  ${samples.length}`);
  console.log(`text-collision samples   ${colliding.length}`);
  console.log(`rail-collision samples   ${railHits.length}`);
  if (worst) console.log("worst text collision    ", JSON.stringify(worst));
  if (railHits.length)
    console.log(
      "rail hits at            ",
      railHits.map((s) => s.progress.toFixed(3)).join(", "),
    );

  // Settled plateaus: runs where exactly one beat is above 0.9.
  const plateau = {};
  for (const s of samples) {
    const solo = s.live.filter((entry) => Number(entry.split(":")[1]) > 0.9);
    if (solo.length === 1) {
      const id = solo[0].split(":")[0];
      plateau[id] = (plateau[id] ?? 0) + 1;
    }
  }
  console.log("");
  console.log("settled plateau width (% of scroll, single beat at full opacity):");
  for (const [id, count] of Object.entries(plateau))
    console.log(`  ${id.padEnd(11)} ${((count / samples.length) * 100).toFixed(1)}%`);

  writeFileSync(
    join(OUT, `story-pacing-sweep-${width}.json`),
    JSON.stringify({ width, height, samples }, null, 2),
  );
  await context.close();
}

async function scroll() {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(
      () => Boolean(document.documentElement.dataset.storyFirstFrameMs),
      undefined,
      { timeout: 120000, polling: 80 },
    )
    .catch(() => {});
  await page.waitForTimeout(400);

  // Slow wheel, fast wheel and trackpad-sized increments, then a stop, then
  // reverse. Each pass records collisions seen while actually moving.
  const passes = [
    { name: "slow wheel", delta: 120, ticks: 60, pause: 45 },
    { name: "trackpad", delta: 42, ticks: 120, pause: 18 },
    { name: "fast wheel", delta: 900, ticks: 24, pause: 30 },
  ];
  const report = [];
  for (const pass of passes) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
    let collisions = 0;
    let railHits = 0;
    let maxProgress = 0;
    for (let tick = 0; tick < pass.ticks; tick += 1) {
      await page.mouse.wheel(0, pass.delta);
      await page.waitForTimeout(pass.pause);
      const probe = await page.evaluate(PROBE, READABLE);
      collisions += probe.collisions.length ? 1 : 0;
      railHits += probe.railCollisions > 0 ? 1 : 0;
      maxProgress = Math.max(maxProgress, probe.progress);
    }
    // Stop and let the scrub settle: the state a reader actually looks at.
    await page.waitForTimeout(1200);
    const settled = await page.evaluate(PROBE, READABLE);
    report.push({
      pass: pass.name,
      ticks: pass.ticks,
      collidingTicks: collisions,
      railHitTicks: railHits,
      maxProgress: Number(maxProgress.toFixed(4)),
      settled: { live: settled.live, collisions: settled.collisions.length },
    });
    console.log(
      `${pass.name.padEnd(12)} ticks=${pass.ticks} collidingTicks=${collisions} ` +
        `railHitTicks=${railHits} maxProgress=${maxProgress.toFixed(3)} ` +
        `settled=[${settled.live.join(" ")}]`,
    );
  }

  // Reverse: scroll to the end, then walk back up.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  let reverseCollisions = 0;
  let reverseRail = 0;
  for (let tick = 0; tick < 80; tick += 1) {
    await page.mouse.wheel(0, -260);
    await page.waitForTimeout(35);
    const probe = await page.evaluate(PROBE, READABLE);
    reverseCollisions += probe.collisions.length ? 1 : 0;
    reverseRail += probe.railCollisions > 0 ? 1 : 0;
  }
  await page.waitForTimeout(1200);
  const reverseSettled = await page.evaluate(PROBE, READABLE);
  report.push({
    pass: "reverse",
    ticks: 80,
    collidingTicks: reverseCollisions,
    railHitTicks: reverseRail,
    settled: {
      live: reverseSettled.live,
      collisions: reverseSettled.collisions.length,
    },
  });
  console.log(
    `reverse      ticks=80 collidingTicks=${reverseCollisions} ` +
      `railHitTicks=${reverseRail} settled=[${reverseSettled.live.join(" ")}]`,
  );

  writeFileSync(
    join(OUT, `story-scroll-qa-${width}.json`),
    JSON.stringify({ width, height, report }, null, 2),
  );
  await context.close();
}

if (mode === "sweep") await sweep();
else await scroll();
await browser.close();
