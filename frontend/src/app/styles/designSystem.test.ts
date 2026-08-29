import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../semantics/format";

/**
 * The design system's rules, pinned.
 *
 * These exist because the audit that produced them found the failures by
 * measurement, not by eye: two thirds of the application's type was under 11.5px,
 * a token that fails WCAG AA was carrying 75 usages, and the colour marking the
 * *current* state was the second-lowest-contrast value in the palette. None of
 * that is visible in a screenshot review, and all of it comes back the moment
 * someone adds "just one more" 0.62rem label.
 *
 * Deliberately not pixel-perfect assertions — these check rules, not renderings.
 */

const read = (relative: string) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");

/** Every stylesheet the logged-in application ships. */
function applicationStyles(): { name: string; css: string }[] {
  const roots = [
    "./",
    "../routes/",
    "../recovery/",
    "../components/",
    "../auth/",
    "../voice/",
  ];
  const files: { name: string; css: string }[] = [];
  for (const root of roots) {
    for (const entry of readdirSync(new URL(root, import.meta.url))) {
      if (entry.endsWith(".css")) {
        files.push({ name: root + entry, css: read(root + entry) });
      }
    }
  }
  return files;
}

function contrast(foreground: string, background: string): number {
  const channel = (hex: string) =>
    [1, 3, 5].map((i) => {
      const value = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  const luminance = (hex: string) => {
    const [r, g, b] = channel(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("type scale", () => {
  it("renders no meaningful application text below the 12px floor", () => {
    const offenders: string[] = [];
    for (const { name, css } of applicationStyles()) {
      for (const match of css.matchAll(/font-size:\s*([0-9.]+)rem/g)) {
        if (Number.parseFloat(match[1]) < 0.75) {
          offenders.push(`${name}: ${match[0]}`);
        }
      }
    }
    expect(
      offenders,
      "application text must not be set below 0.75rem; use a --type-* token",
    ).toEqual([]);
  });

  it("sizes come from the scale rather than ad-hoc values", () => {
    const literals = new Set<string>();
    for (const { css } of applicationStyles()) {
      for (const match of css.matchAll(/font-size:\s*([0-9.]+)rem/g)) {
        literals.add(match[1]);
      }
    }
    // Four authored serif sizes predate the scale and are deliberately kept.
    expect(literals.size).toBeLessThanOrEqual(6);
  });
});

describe("contrast tiers", () => {
  const tokens = read("./tokens.css");
  const value = (name: string) => {
    const found = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"));
    if (!found)
      throw new Error(`${name} is not a literal colour in tokens.css`);
    return found[1];
  };
  const surfaces = ["--surface", "--canvas", "--surface-elevated"].map(value);

  it("metadata passes AA for normal text on every application surface", () => {
    for (const surface of surfaces) {
      expect(
        contrast(value("--text-metadata"), surface),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the failing muted tone out of everything but disabled state", () => {
    // `--secondary` measures 3.13:1 on canvas. It may still exist as the
    // de-emphasised tier, but nothing should be reaching for it directly.
    const direct = applicationStyles().filter(({ css }) =>
      /(^|[;{\n])\s*color:\s*var\(--secondary\)/.test(css),
    );
    expect(direct.map((file) => file.name)).toEqual([]);
  });
});

describe("state semantics", () => {
  it("never carries state on brass or sage alone", () => {
    // Both fail AA (2.63:1 and 2.48:1). They are ornament, rule, wash and fill —
    // never the only thing telling a reader what state something is in.
    const offenders: string[] = [];
    for (const { name, css } of applicationStyles()) {
      // Whole rules, so the selector can be judged as well as the declaration.
      for (const rule of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const selector = rule[1].trim();
        const body = rule[2];
        // `border-color` and `border-left-color` are rule and accent — permitted.
        if (!/(^|[;\n])\s*color:\s*var\(--(brass|sage)\)/.test(body)) continue;
        // An icon glyph sitting beside a readable label is ornament, not the
        // carrier of a state. Only text-bearing selectors are held to this.
        if (/\bsvg\b|\bi$|\bi[,\s]/.test(selector)) continue;
        offenders.push(`${name}: ${selector}`);
      }
    }
    expect(
      offenders,
      "brass and sage fail AA; they may not carry state as text colour",
    ).toEqual([]);
  });
});

describe("relative time", () => {
  const at = (iso: string) => new Date(iso);
  const now = at("2026-08-29T12:00:00Z");

  it("leads with recency across the ranges a reader actually sees", () => {
    expect(formatRelativeTime("2026-08-29T11:59:40Z", now)).toBe("Just now");
    expect(formatRelativeTime("2026-08-29T11:56:00Z", now)).toBe("4 min ago");
    expect(formatRelativeTime("2026-08-29T10:00:00Z", now)).toBe("2 hours ago");
    expect(formatRelativeTime("2026-08-28T11:00:00Z", now)).toBe("Yesterday");
    expect(formatRelativeTime("2026-08-25T12:00:00Z", now)).toBe("4 days ago");
  });

  it("never renders a negative age from clock skew", () => {
    expect(formatRelativeTime("2026-08-29T12:05:00Z", now)).toBe("Just now");
  });

  it("returns null for a missing or unparseable value rather than guessing", () => {
    expect(formatRelativeTime(null, now)).toBeNull();
    expect(formatRelativeTime("not a date", now)).toBeNull();
  });
});
