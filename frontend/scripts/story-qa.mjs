#!/usr/bin/env node
/**
 * Bounded visual QA for the recovery story. Proof tooling, not product code.
 *
 * This replaces an earlier harness that reloaded the Three.js page once per
 * progress sample — 201 loads, each waiting on a WebGL first frame. It ran for
 * a very long time and had to be stopped by hand. The point of story QA is to
 * catch visible regressions, not to exhaust the timeline, so this one:
 *
 *   uses ONE initialised page per viewport;
 *   inspects only the meaningful settled states, not every percent;
 *   drives real wheel scrolling in a few short passes and samples every fifth
 *   tick rather than every tick.
 *
 * Two modes:
 *
 *   node scripts/story-qa.mjs rail 1920 1080   # rail geometry per settled state
 *   node scripts/story-qa.mjs scroll           # natural, fast, reverse, dwell stops
 */
import { chromium } from "playwright-core";
const CH = process.env.REFLOW_CHROMIUM ?? "C:/Users/OMEN/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const B = process.env.REFLOW_PREVIEW_URL ?? "http://127.0.0.1:4174";
const MODE = process.argv[2] ?? "rail";

if (MODE === "rail") {
  const W = Number(process.argv[3] || 1920), H = Number(process.argv[4] || 1080);
  const frames = ["hero","risk","futures","action","incomplete","replan","restored"];
  const browser = await chromium.launch({ executablePath: CH, headless: true, args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-renderer-backgrounding"] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  for (const f of frames) {
    await page.goto(`${B}/?frame=${f}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(()=>Boolean(document.documentElement.dataset.storyFirstFrameMs),undefined,{timeout:120000,polling:100}).catch(()=>{});
    await page.waitForTimeout(350);
    const r = await page.evaluate((frameId) => {
      const rail = document.querySelector(".story-progress");
      if (!rail || getComputedStyle(rail).display === "none")
        return { rail: "hidden", overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      const rb = rail.getBoundingClientRect();
      const hits = [];
      // Any visible element from the active beat, or any orbital label, inside the rail box.
      const beat = document.querySelector(`[data-beat='${frameId}']`);
      const cands = [...(beat ? beat.querySelectorAll("*") : []), ...document.querySelectorAll(".orbital-rail-system text")];
      for (const el of cands) {
        const b = el.getBoundingClientRect();
        if (b.width < 20 || b.height < 8) continue;
        if (Number(getComputedStyle(el).opacity) < 0.15) continue;
        if (b.right > rb.left && b.left < rb.right && b.bottom > rb.top && b.top < rb.bottom)
          hits.push((el.textContent || el.className || "?").toString().trim().slice(0,26));
      }
      // Clipping: any rail label extending past the viewport.
      let clipped = 0;
      for (const t of rail.querySelectorAll(".rail-name, .rail-phase")) {
        const b = t.getBoundingClientRect();
        if (b.right > window.innerWidth - 1 || b.left < 0) clipped++;
      }
      const active = rail.querySelector('[data-rail-state="active"] .rail-name');
      return { railLeft: Math.round(rb.left), railRight: Math.round(rb.right),
               hits: [...new Set(hits)].slice(0,4), clipped,
               active: active ? active.textContent : null,
               overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    }, f);
    console.log(`${W} ${f.padEnd(11)} rail=${r.rail ?? (r.railLeft+"-"+r.railRight)} active="${r.active ?? "-"}" clipped=${r.clipped ?? "-"} overflow=${r.overflow}px hits=${(r.hits||[]).length}${(r.hits||[]).length?" "+JSON.stringify(r.hits):""}`);
  }
  await browser.close();

} else {
  const browser = await chromium.launch({ executablePath: CH, headless: true, args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--disable-renderer-backgrounding","--disable-background-timer-throttling"] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(B, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(()=>Boolean(document.documentElement.dataset.storyFirstFrameMs),undefined,{timeout:120000,polling:100}).catch(()=>{});
  await page.waitForTimeout(400);
  const PROBE = () => {
    const live = [...document.querySelectorAll("[data-beat]")]
      .map(el => ({ id: el.dataset.beat, o: Number(getComputedStyle(el).opacity), v: getComputedStyle(el).visibility, el }))
      .filter(b => b.v !== "hidden" && b.o > 0.12);
    const reg = (el) => { const p=[...el.children].map(c=>c.getBoundingClientRect()).filter(r=>r.width>60&&r.height>24);
      return p.length?{l:Math.min(...p.map(r=>r.left)),r:Math.max(...p.map(r=>r.right)),t:Math.min(...p.map(r=>r.top)),b:Math.max(...p.map(r=>r.bottom))}:null; };
    let col = 0;
    for (let i=0;i<live.length;i++) for (let j=i+1;j<live.length;j++) {
      const a=reg(live[i].el), b=reg(live[j].el);
      if (a&&b&&Math.min(a.r,b.r)>Math.max(a.l,b.l)&&Math.min(a.b,b.b)>Math.max(a.t,b.t)) col++;
    }
    const active = document.querySelector('[data-rail-state="active"] .rail-name');
    return { p:+getComputedStyle(document.documentElement).getPropertyValue("--story-progress")||0,
             live: live.map(b=>b.id+":"+b.o.toFixed(2)), col,
             active: active?active.textContent:null,
             overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  };
  // Bounded: 4 passes, sampling every 5th tick only.
  for (const [name,delta,ticks,pause] of [["slow wheel",140,30,50],["normal wheel",340,20,40],["fast/trackpad",900,12,30]]) {
    await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(800);
    let col=0, max=0, samples=0;
    for (let t=0;t<ticks;t++){ await page.mouse.wheel(0,delta); await page.waitForTimeout(pause);
      if (t%5===0){ const r=await page.evaluate(PROBE); samples++; if(r.col)col++; max=Math.max(max,r.p); } }
    await page.waitForTimeout(1300);
    const s = await page.evaluate(PROBE);
    console.log(`${name.padEnd(14)} ticks=${ticks} sampled=${samples} collidingSamples=${col} maxProgress=${max.toFixed(3)} settled=[${s.live.join(" ")}] rail="${s.active}" overflow=${s.overflow}px`);
  }
  // Reverse
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await page.waitForTimeout(1300);
  let rc=0, rs=0;
  for (let t=0;t<30;t++){ await page.mouse.wheel(0,-400); await page.waitForTimeout(40);
    if (t%5===0){ const r=await page.evaluate(PROBE); rs++; if(r.col)rc++; } }
  await page.waitForTimeout(1300);
  const r = await page.evaluate(PROBE);
  console.log(`reverse        ticks=30 sampled=${rs} collidingSamples=${rc} settled=[${r.live.join(" ")}] rail="${r.active}" overflow=${r.overflow}px`);
  // Stop at a few natural dwell points and read the rail.
  for (const target of [0.19, 0.34, 0.49, 0.63, 0.78, 0.93]) {
    await page.evaluate((t)=>{ const track=document.querySelector(".story-track"); const rect=track.getBoundingClientRect();
      const top=window.scrollY+rect.top; window.scrollTo(0, top + (track.offsetHeight - window.innerHeight)*t); }, target);
    await page.waitForTimeout(1100);
    const s = await page.evaluate(PROBE);
    console.log(`dwell ${target.toFixed(2)}     live=[${s.live.join(" ")}] rail="${s.active}" collisions=${s.col}`);
  }
  await browser.close();

}
