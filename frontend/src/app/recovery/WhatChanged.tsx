import type { AttemptComparisonItem } from "../contract/uiContract";

/**
 * The backend's own attempt comparison (`RecoveryCaseView.what_changed`).
 *
 * Reflow does not diff the two attempts in the client — the fields, the values and
 * the pairing are all supplied. This component lays them out.
 *
 * Column headers are generic ("Recovery 01" / "Recovery 02") because the contract's
 * item shape is `recovery_1` / `recovery_2`; a third attempt would need a wider
 * comparison resource rather than a client-side extension of this one.
 */
export function WhatChanged({
  items,
  variant = "table",
}: {
  items: AttemptComparisonItem[];
  variant?: "table" | "band";
}) {
  if (items.length === 0) return null;

  if (variant === "band") {
    return (
      <div className="what-changed-band">
        {items.map((item) => (
          <div key={item.field} className="what-changed-cell">
            <span className="field-label">{item.field}</span>
            <span className="what-changed-value is-before mono">
              <i aria-hidden="true">R01</i>
              {item.recovery_1 ?? "—"}
            </span>
            <span className="what-changed-value is-after mono">
              <i aria-hidden="true">R02</i>
              {item.recovery_2 ?? "—"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th style={{ width: "26%" }}>Aspect</th>
          <th style={{ width: "37%" }}>Recovery 01</th>
          <th style={{ width: "37%" }}>Recovery 02</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.field}>
            <td>{item.field}</td>
            <td className="mono">{item.recovery_1 ?? "—"}</td>
            <td className="mono">{item.recovery_2 ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
