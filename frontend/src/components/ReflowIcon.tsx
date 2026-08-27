import React from "react";
import spriteUrl from "../assets/reflow/reflow-status-icons.sprite.svg";

export type ReflowIconName =
  | "disruption-marker"
  | "objective-at-risk"
  | "verification-state"
  | "recovery-replan"
  | "failure-fracture"
  | "recovery-selected"
  | "policy-rejected"
  | "readback-verified";

interface ReflowIconProps extends React.SVGProps<SVGSVGElement> {
  name: ReflowIconName;
  size?: number | string;
}

/**
 * Renders a production asset from SVG Set B.
 * 
 * Rules:
 * - Use only for Reflow-specific semantics, not generic concepts (like user, lock).
 * - Recommended UI size: 20-28px. Hero/story use: 32-48px.
 * - Do not recolor failure/warning to bright red.
 */
export function ReflowIcon({ name, size = 24, className = "", ...props }: ReflowIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64" // Set B native geometry
      className={`reflow-icon reflow-icon-${name} ${className}`}
      aria-hidden="true"
      {...props}
    >
      <use href={`${spriteUrl}#${name}`} />
    </svg>
  );
}
