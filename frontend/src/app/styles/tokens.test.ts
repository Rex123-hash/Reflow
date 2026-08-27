import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The application mirrors the frozen public surface's tokens rather than editing
 * src/styles.css. This test is what makes that safe: if a brand value changes on
 * either side, the mirror stops matching and the build fails.
 */

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

const MIRRORED = [
  "--canvas",
  "--surface",
  "--surface-elevated",
  "--ink",
  "--forest",
  "--forest-hover",
  "--sage",
  "--pale-sage",
  "--brass",
  "--warning",
  "--failure",
  "--body",
  "--secondary",
  "--line",
];

function declarations(css: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of css.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    if (!found.has(match[1])) found.set(match[1], match[2].trim());
  }
  return found;
}

describe("design tokens", () => {
  const marketing = declarations(read("../../styles.css"));
  const application = declarations(read("./tokens.css"));

  it("mirrors every brand token from the frozen public stylesheet", () => {
    for (const token of MIRRORED) {
      expect(
        marketing.get(token),
        `${token} missing from src/styles.css`,
      ).toBeDefined();
      expect(application.get(token), `${token} missing from tokens.css`).toBe(
        marketing.get(token),
      );
    }
  });

  it("introduces no hue outside the frozen palette", () => {
    const marketingHexes = new Set(
      [...read("../../styles.css").matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) =>
        m[0].toLowerCase(),
      ),
    );
    const applicationHexes = [
      ...read("./tokens.css").matchAll(/#[0-9a-f]{3,8}\b/gi),
    ].map((m) => m[0].toLowerCase());

    // The application adds darker and lighter tints for text contrast and washes.
    // Those are allowed, but only as tints of an existing brand hue — never as a
    // new hue. Anything the marketing sheet does not already contain must sit
    // within 8 degrees of a frozen brand colour.
    const brandHues = [...marketingHexes]
      .map(hue)
      .filter((h): h is number => h != null);
    const novel = applicationHexes.filter((hex) => !marketingHexes.has(hex));

    const offHue = novel.filter((hex) => {
      const h = hue(hex);
      if (h == null) return true;
      return !brandHues.some((brand) => Math.abs(brand - h) <= 8);
    });

    expect(
      offHue,
      "application tints must stay within the frozen hues",
    ).toEqual([]);
  });
});

/** Hue in degrees, or null for a hex this crude parser does not handle. */
function hue(hex: string): number | null {
  const value = hex.replace("#", "");
  if (value.length !== 6) return null;
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let h: number;
  if (max === r) h = 60 * (((g - b) / delta) % 6);
  else if (max === g) h = 60 * ((b - r) / delta + 2);
  else h = 60 * ((r - g) / delta + 4);
  return (h + 360) % 360;
}
