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
 * Rendered in the vendor's own brand colour, from the vendored brand data, so the
 * service is recognisable as itself. An earlier pass drew these monochrome to
 * protect the ivory-and-forest palette; a real logo in its real colour reads as a
 * genuine third-party system rather than as Reflow's own iconography, which is the
 * whole point of showing it. The colour is fixed to the brand and never shifts —
 * the mark says WHO observed something, and the VERIFIED pill beside it says
 * whether it held.
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
        <path d={mark.path} fill={mark.hex} />
      </svg>
    </span>
  );
}
