import type { SVGProps, ReactElement } from "react";

type GlyphName =
  | "check"
  | "cross"
  | "chevron-down"
  | "chevron-right"
  | "arrow-right"
  | "external"
  | "search"
  | "shield"
  | "info"
  | "branch"
  | "terminal"
  | "clock"
  | "lock";

const PATHS: Record<GlyphName, ReactElement> = {
  check: <path d="M4 12.5l5.2 5.2L20 6.4" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "arrow-right": <path d="M4 12h15M13 6l6 6-6 6" />,
  external: (
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  shield: (
    <path d="M12 3l7.5 3.6v5.2c0 4.4-3.1 8.2-7.5 9.2-4.4-1-7.5-4.8-7.5-9.2V6.6z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.6v5.6M12 16.6v.01" />
    </>
  ),
  branch: (
    <>
      <path d="M4 6v6a8 8 0 008 8h7" />
      <path d="M16 16l4 4-4 4" />
    </>
  ),
  terminal: <path d="M5 7l5 5-5 5M13 17h6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.4l3.4 2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 018 0v2.7" />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: GlyphName;
  size?: number;
  strokeWidth?: number;
}

/** Stroke-based UI glyphs on a 24px grid. Never used to identify an integration. */
export function Icon({
  name,
  size = 16,
  strokeWidth = 1.8,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
