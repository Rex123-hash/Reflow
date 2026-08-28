#!/usr/bin/env node
/**
 * Generates `src/app/contract/uiContract.ts` from `docs/ui-openapi.json`.
 *
 * The P2A presentation contract is backend-owned. These types are never edited by
 * hand: re-run this script whenever `docs/ui-openapi.json` changes.
 *
 *   node scripts/generate-ui-contract.mjs           # write
 *   node scripts/generate-ui-contract.mjs --check   # fail if the checked-in file is stale
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SPEC = resolve(here, "../../docs/ui-openapi.json");
const OUT = resolve(here, "../src/app/contract/uiContract.ts");
const OUT_SPEC = resolve(here, "../src/app/contract/ui-openapi.json");

const specText = readFileSync(SPEC, "utf8");
const spec = JSON.parse(specText);
const schemas = spec.components.schemas;

/** Schemas that describe FastAPI/Pydantic error envelopes rather than presentation resources. */
const SKIP = new Set(["HTTPValidationError", "ValidationError"]);

const refName = (ref) => ref.replace("#/components/schemas/", "");

function tsType(schema, indent) {
  if (!schema) return "unknown";
  if (schema.$ref) return refName(schema.$ref);

  if (schema.anyOf) {
    const parts = schema.anyOf.map((s) => tsType(s, indent));
    const unique = [...new Set(parts)];
    // `anyOf: [T, null]` is Pydantic's optional; keep the null in the type.
    return unique.join(" | ");
  }

  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  }

  switch (schema.type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      return `${wrapUnion(tsType(schema.items, indent))}[]`;
    case "object": {
      if (schema.properties) return inlineObject(schema, indent);
      const value = schema.additionalProperties
        ? tsType(schema.additionalProperties, indent)
        : "unknown";
      return `Record<string, ${value}>`;
    }
    default:
      return "unknown";
  }
}

const wrapUnion = (t) => (t.includes(" | ") ? `(${t})` : t);

function inlineObject(schema, indent) {
  const pad = " ".repeat(indent + 2);
  const required = new Set(schema.required ?? []);
  const body = Object.entries(schema.properties)
    .map(([key, value]) => {
      const optional = required.has(key) ? "" : "?";
      return `${pad}${key}${optional}: ${tsType(value, indent + 2)};`;
    })
    .join("\n");
  return `{\n${body}\n${" ".repeat(indent)}}`;
}

function renderNamed(name, schema) {
  const doc = schema.description ? `/** ${schema.description} */\n` : "";
  if (schema.enum) {
    const members = schema.enum
      .map((v) => `  | ${JSON.stringify(v)}`)
      .join("\n");
    return `${doc}export type ${name} =\n${members};`;
  }
  if (schema.type === "object" && schema.properties) {
    const required = new Set(schema.required ?? []);
    const body = Object.entries(schema.properties)
      .map(([key, value]) => {
        const optional = required.has(key) ? "" : "?";
        return `  ${key}${optional}: ${tsType(value, 2)};`;
      })
      .join("\n");
    return `${doc}export interface ${name} {\n${body}\n}`;
  }
  return `${doc}export type ${name} = ${tsType(schema, 0)};`;
}

const version = spec.info?.version ?? "unknown";
const blocks = Object.keys(schemas)
  .filter((name) => !SKIP.has(name))
  .sort()
  .map((name) => renderNamed(name, schemas[name]));

const header = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: docs/ui-openapi.json (API version ${version})
 * Regenerate: npm run contract:generate
 *
 * These are the P2A presentation resources. The backend owns every semantic value
 * in this file. The frontend renders them; it never recomputes them.
 */

/* eslint-disable */
`;

const output = `${header}\n${blocks.join("\n\n")}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* missing file falls through to the mismatch branch */
  }
  if (current !== output) {
    console.error(
      "ui contract types are stale — run `npm run contract:generate` and commit the result.",
    );
    process.exit(1);
  }
  let currentSpec = "";
  try {
    currentSpec = readFileSync(OUT_SPEC, "utf8");
  } catch {
    /* missing file falls through to the mismatch branch */
  }
  if (currentSpec !== specText) {
    console.error(
      "bundled UI OpenAPI is stale — run `npm run contract:generate` and commit the result.",
    );
    process.exit(1);
  }
  console.log("ui contract types are up to date.");
} else {
  writeFileSync(OUT, output, "utf8");
  writeFileSync(OUT_SPEC, specText, "utf8");
  console.log(`wrote ${OUT} (${blocks.length} types from API ${version})`);
}
