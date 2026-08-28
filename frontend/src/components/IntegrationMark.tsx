import { INTEGRATION_MARKS } from "../app/assets/integrationMarks";

/**
 * The real brand mark for an external authority the story cites as evidence.
 *
 * The action-receipt card was showing a forest square containing the literal text
 * "31" — a stand-in for the Google Calendar logo. The approved reference shows the
 * actual Calendar mark, and a hand-typed date in a box is exactly the placeholder
 * treatment this pass exists to remove.
 *
 * The marks are the vendored official ones (`simple-icons`, generated into
 * `app/assets/integrationMarks.ts`), so nothing is redrawn by hand. Importing that
 * generated module here does not affect bundle isolation: the constraint is that
 * `/app` must not pull in marketing, not the reverse, and the module is three path
 * strings.
 *
 * Rendered monochrome in ink rather than in vendor colour. The reference shows the
 * multicolour Calendar lockup, but the page's whole palette discipline is warm
 * ivory and forest, and a four-colour logo is the one thing on the page that would
 * break it. Monochrome is still the official geometry, and it matches how the same
 * marks are drawn in the product. Crucially the mark never carries state — the
 * VERIFIED pill beside it does that.
 */
export function IntegrationMark({
  name,
  label,
  size = 22,
}: {
  name: keyof typeof INTEGRATION_MARKS | string;
  label: string;
  size?: number;
}) {
  const mark = INTEGRATION_MARKS[name as keyof typeof INTEGRATION_MARKS];
  if (!mark) return null;

  return (
    <span className="integration-mark" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
        <path d={mark.path} fill="currentColor" />
      </svg>
    </span>
  );
}
