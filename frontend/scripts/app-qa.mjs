#!/usr/bin/env node
/**
 * Visual-QA harness for the logged-in application. Proof tooling, not product code.
 *
 * The application talks to the private BFF, which is not reachable from a local
 * checkout, so every capture would otherwise stop at the sign-in wall. This harness
 * fulfils `/api/**` from the committed presentation fixtures — the same JSON shape
 * the backend contract produces — so the shell, spacing and route composition can be
 * photographed at real viewport widths without a backend and without adding a
 * development backdoor to the product.
 *
 * It does not invent semantics: every payload is a fixture the contract validators
 * already accept, and the Operator payload below is a recorded-shape response used
 * only to photograph layout.
 *
 *   node scripts/app-qa.mjs --tag before
 *   node scripts/app-qa.mjs --tag after --only 390
 *   node scripts/app-qa.mjs --route operator --ask inspect --only 1440
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../visual-qa/app");
const FIXTURES = resolve(here, "../src/app/data/fixtures");

const CHROMIUM =
  process.env.REFLOW_CHROMIUM ??
  "C:/Users/OMEN/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = process.env.REFLOW_PREVIEW_URL ?? "http://127.0.0.1:4174";

const FLAGS = [
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--disable-features=CalculateNativeWinOcclusion",
];

const VIEWPORTS = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1280", width: 1280, height: 800 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "390", width: 390, height: 844 },
];

const fixture = (name) =>
  JSON.parse(readFileSync(join(FIXTURES, name + ".json"), "utf8"));

const overview = fixture("overview");
const INCIDENT = overview.current_priority.incident_id;

const ROUTES = [
  { name: "overview", path: "/app/overview", ready: ".overview" },
  { name: "objectives", path: "/app/objectives", ready: ".objectives" },
  {
    name: "recovery",
    path: "/app/recovery/" + INCIDENT,
    ready: ".recovery-body",
  },
  { name: "operator", path: "/app/operator", ready: ".operator" },
  {
    name: "evidence",
    path: "/app/evidence/" + INCIDENT,
    ready: ".evidence-page",
  },
];

const SESSION = {
  mode: "live",
  workspace_label: "Live workspace",
  email: "operator@reflow.dev",
  display_name: "Amaan Khan",
  read_only: false,
};

/**
 * A recorded-shape Operator response. Used only to photograph the answer layout,
 * with realistic text lengths so the hierarchy is exercised honestly.
 */
const OPERATOR_ANSWER = {
  agents: [
    {
      agent_id: "operator_intent_interpreter",
      attempts: 1,
      input_tokens: 1804,
      latency_ms: 742,
      model: "gemini-3.7-flash",
      output_tokens: 212,
      request_id: "9f2c41ae-6b1d-4f0e-9c22-7ad3b5e10c48",
      total_tokens: 2016,
      validation: "PASSED",
    },
  ],
  answer:
    "Reflow moved the release validation window in Google Calendar. The event " +
    "Release v2 validation was rescheduled from 15:00 to 16:30 UTC on 28 August, " +
    "and the change was read back from Calendar after the write.\n\n" +
    "The read-back confirms the calendar action itself. It does not confirm the " +
    "objective: Recovery 1 still failed objective verification because the release " +
    "candidate did not pass required CI before the protected deadline.",
  disposition: "SUPPORTED",
  evidence: [
    {
      evidence_id: "calendar-write:1",
      observed_at: "2026-08-27T19:07:45.772017+00:00",
      title: "Calendar event rescheduled",
    },
    {
      evidence_id: "calendar-readback:1",
      observed_at: "2026-08-27T19:07:51.104233+00:00",
      title: "Calendar read-back after write",
    },
    {
      evidence_id: "objective-verification:1",
      observed_at: "2026-08-27T19:08:04.331902+00:00",
      title: "Recovery 01 objective verification",
    },
  ],
  external_effects_executed: false,
  facts: [
    {
      evidence_ids: ["calendar-write:1", "calendar-readback:1"],
      fact_id: "calendar:1",
      text: "The validation window was moved to 16:30 UTC and read back.",
    },
  ],
  generated_at: "2026-08-28T12:41:07.882140+00:00",
  hypothetical_deadline: null,
  incident_id: INCIDENT,
  intent: {
    clarification: null,
    constraints: [],
    disposition: "SUPPORTED",
    fact_ids: ["calendar:1"],
    hypothetical_changes: [],
    incident_id: INCIDENT,
    intent_type: "INSPECT",
    question: "What did Reflow change in Google Calendar?",
    recovery_attempt: 1,
    subject: "CALENDAR",
  },
  provenance: "AUTHORITATIVE_SNAPSHOT",
  request_id: "9f2c41ae-6b1d-4f0e-9c22-7ad3b5e10c48",
  revision: 16,
  simulation: null,
  snapshot_fingerprint: "c".repeat(64),
};

const SIMULATION_ANSWER = {
  ...OPERATOR_ANSWER,
  answer:
    "If Candidate A had passed CI before the protected deadline, the release " +
    "validation window Reflow already secured would have been sufficient to attempt " +
    "objective verification on the first recovery.\n\n" +
    "This is a hypothetical reconstruction. No production action was taken and the " +
    "real protected deadline is unchanged.",
  hypothetical_deadline: "2026-08-28T17:00:00+00:00",
  intent: {
    ...OPERATOR_ANSWER.intent,
    intent_type: "SIMULATE",
    question: "What if Candidate A had passed CI?",
    hypothetical_changes: [
      { kind: "CI_PASSED", target: "candidate-a", value: "true" },
    ],
    subject: "RECOVERY",
  },
  provenance: "HYPOTHETICAL_NO_ACTION",
  simulation: {
    assumptions: [
      "Candidate A completes required CI at or before 16:10 UTC.",
      "No further disruption to the release validation window.",
    ],
    candidate_futures: [
      {
        consequence:
          "Objective verification runs once against Candidate A inside the protected window.",
        required_verification: [
          "Required CI checks reported green",
          "Objective invariants re-evaluated",
        ],
        title: "Verify Candidate A in the secured window",
        tradeoffs: ["No margin left for a second attempt if verification fails."],
      },
      {
        consequence:
          "Verification is deferred to the following window and the deadline is missed.",
        required_verification: ["Objective invariants re-evaluated"],
        title: "Defer verification to the next window",
        tradeoffs: ["The protected deadline would not be met."],
      },
    ],
    evidence_ids: ["objective-verification:1"],
    external_effects_executed: false,
    likely_objective_outcome: "MAY_IMPROVE",
    provenance: "HYPOTHETICAL_NO_ACTION",
    risk_critique: ["A green CI run is not itself objective verification."],
    scenario_summary: "Candidate A passes CI before the deadline.",
    threatened_invariants: ["release.candidate.verified"],
    unsupported_assumptions: ["Assumes no queue contention on the CI runner."],
  },
};

const argv = process.argv.slice(2);
const value = (name, fallback) => {
  const index = argv.indexOf("--" + name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};
const tag = value("tag", "current");
const only = value("only", null);
const routeOnly = value("route", null);
const ask = value("ask", null); // "inspect" | "simulate"

mkdirSync(OUT, { recursive: true });

/** Serve every application API path this pass photographs from the fixtures. */
async function installApi(context) {
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "/api/auth/session") return json(SESSION);
    if (path === "/api/v1/ui/overview") return json(overview);
    if (path === "/api/v1/ui/objectives") return json(fixture("objectives"));
    if (path === "/api/v1/ui/operator/context")
      return json(fixture("operator-context"));
    if (path.endsWith("/external-reality"))
      return json(fixture("external-reality"));
    if (path.endsWith("/events")) return json(fixture("events"));
    if (path.startsWith("/api/v1/ui/evidence/")) return json(fixture("evidence"));
    if (path.startsWith("/api/v1/ui/recoveries/"))
      return json(fixture("recovery-restored"));
    if (path === "/api/v1/operator/query")
      return json(ask === "simulate" ? SIMULATION_ANSWER : OPERATOR_ANSWER);
    return route.fulfill({ status: 404, body: "{}" });
  });
}

async function capture(browser, viewport, target) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  await installApi(context);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(BASE + target.path, { waitUntil: "domcontentloaded" });
  let ready = true;
  try {
    await page.waitForSelector(target.ready, { timeout: 25000 });
  } catch {
    ready = false;
  }

  if (target.name === "operator" && ask && ready) {
    await page.fill("#operator-query", OPERATOR_ANSWER.intent.question);
    await page.click("form.operator-form button[type=submit]");
    await page.waitForSelector(".operator-result", { timeout: 25000 });
  }

  await page.waitForTimeout(400);

  // Horizontal overflow is a hard gate for the mobile navigation work.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  const suffix = ask ? "-" + ask : "";
  const file = join(OUT, tag + "-" + target.name + suffix + "-" + viewport.name + ".png");
  await page.screenshot({ path: file, fullPage: target.name !== "recovery" });
  await context.close();
  return {
    route: target.name,
    viewport: viewport.name,
    ready,
    overflowPx: overflow.scrollWidth - overflow.clientWidth,
    consoleErrors,
    file,
  };
}

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: FLAGS,
});
const viewports = only ? VIEWPORTS.filter((v) => v.name === only) : VIEWPORTS;
const routes = routeOnly ? ROUTES.filter((r) => r.name === routeOnly) : ROUTES;
const results = [];
for (const target of routes) {
  for (const viewport of viewports) {
    const result = await capture(browser, viewport, target);
    results.push(result);
    console.log(
      target.name.padEnd(11) +
        " " +
        viewport.name.padEnd(7) +
        " " +
        (result.ready ? "ok " : "NOT-READY") +
        " overflow=" +
        result.overflowPx +
        "px errors=" +
        result.consoleErrors.length +
        " -> " +
        result.file.split(/[\\/]/).pop(),
    );
    if (result.consoleErrors.length)
      console.log("   ", result.consoleErrors.slice(0, 2).join(" | "));
  }
}
await browser.close();
writeFileSync(
  join(OUT, tag + (ask ? "-" + ask : "") + ".json"),
  JSON.stringify({ base: BASE, incident: INCIDENT, results }, null, 2),
);
