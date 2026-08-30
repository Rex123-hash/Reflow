/**
 * Merge transcription updates within one Live turn.
 *
 * Live interim hypotheses are replacements, while older/final streams may still
 * arrive as deltas. Prefix and exact suffix/prefix overlap handle both forms without
 * guessing at semantic similarity. Callers reset the accumulator at a real turn
 * boundary, so separate utterances are never compared or collapsed.
 */
export function mergeTranscriptFragment(
  current: string,
  incoming: string,
): string {
  const left = current.replace(/\s+/g, " ").trim();
  const right = incoming.replace(/\s+/g, " ").trim();
  if (!right) return left;
  if (!left) return right;

  const foldedLeft = left.toLocaleLowerCase();
  const foldedRight = right.toLocaleLowerCase();
  if (foldedLeft === foldedRight || foldedLeft.startsWith(foldedRight))
    return left;
  if (foldedRight.startsWith(foldedLeft)) return right;

  const maximum = Math.min(left.length, right.length);
  for (let size = maximum; size >= 3; size -= 1) {
    if (
      foldedLeft.slice(-size) === foldedRight.slice(0, size) &&
      (size === right.length || /\s/.test(right[size] ?? ""))
    ) {
      return `${left}${right.slice(size)}`;
    }
  }
  return `${left} ${right}`;
}
