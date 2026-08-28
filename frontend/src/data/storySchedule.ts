/**
 * The recovery story's timing, as data.
 *
 * The scroll story used to be sixty hand-placed timeline positions, and the shape
 * they added up to had two faults that only showed under capture:
 *
 *   every beat began entering while the previous beat was still fading, so two
 *   large narrative blocks were legible in the same region at once;
 *
 *   every beat finished assembling itself at or after its own exit began. The
 *   fully-composed PLAN state, for instance, existed for about 1% of scroll —
 *   the three future cards landed at 37.9 and the beat started leaving at 39 —
 *   so the composition the design was built around was never actually seen.
 *
 * Each beat now owns a slot with an explicit ENTER → SETTLE → DWELL → EXIT shape,
 * and the next beat's slot starts where the previous one's exit *ends*. Nothing
 * enters while anything else is still readable, and every beat has a long still
 * plateau in the middle where nothing at all moves — text, instrument or route
 * overlay. Roughly two thirds of the story is settled and one third is transition.
 *
 * The units are arbitrary timeline units; only their ratios matter. Progress is
 * derived from them, so the capture frames, the stage boundaries, the phase rail
 * and the SVG route overlays cannot drift apart from the animation again.
 */

export type StoryStageId =
  | "hero"
  | "risk"
  | "futures"
  | "action"
  | "incomplete"
  | "replan"
  | "restored";

interface BeatTiming {
  id: StoryStageId;
  /** Assembling: the beat and everything inside it arrives. */
  enter: number;
  /** Settled: fully composed and completely still. */
  dwell: number;
  /** Leaving: the beat clears the field before the next one starts. */
  exit: number;
}

/**
 * `enter` is sized to the beat's own content — six units is enough for a heading
 * and a marker, nine is what the five-node impact diagram and the four-step replan
 * ladder need to arrive without feeling rushed. `dwell` is then set so the settled
 * state is comfortably the longest part of the beat.
 */
const BEATS: readonly BeatTiming[] = [
  { id: "hero", enter: 0, dwell: 22, exit: 5 },
  { id: "risk", enter: 8, dwell: 26, exit: 5 },
  { id: "futures", enter: 7, dwell: 24, exit: 5 },
  { id: "action", enter: 9, dwell: 26, exit: 5 },
  { id: "incomplete", enter: 6, dwell: 22, exit: 5 },
  { id: "replan", enter: 9, dwell: 26, exit: 5 },
  { id: "restored", enter: 9, dwell: 26, exit: 4 },
] as const;

export interface StoryBeatWindow {
  id: StoryStageId;
  /** Timeline units. */
  start: number;
  settleAt: number;
  exitAt: number;
  end: number;
  enter: number;
  dwell: number;
  exit: number;
  /** The same four moments as scroll progress, 0–1. */
  startP: number;
  settleP: number;
  exitP: number;
  endP: number;
  /** Middle of the settled plateau: the canonical capture point for this beat. */
  frameP: number;
}

function build() {
  let cursor = 0;
  const raw = BEATS.map((beat) => {
    const start = cursor;
    const settleAt = start + beat.enter;
    const exitAt = settleAt + beat.dwell;
    const end = exitAt + beat.exit;
    cursor = end;
    return { ...beat, start, settleAt, exitAt, end };
  });
  const duration = cursor;
  const order = raw.map((beat) => beat.id);
  const windows = {} as Record<StoryStageId, StoryBeatWindow>;
  for (const beat of raw) {
    windows[beat.id] = {
      ...beat,
      startP: beat.start / duration,
      settleP: beat.settleAt / duration,
      exitP: beat.exitAt / duration,
      endP: beat.end / duration,
      frameP: (beat.settleAt + beat.dwell / 2) / duration,
    };
  }
  return { duration, order, windows };
}

const built = build();

/** Total length of the scrubbed timeline, in timeline units. */
export const STORY_TIMELINE_DURATION = built.duration;

export const STORY_BEAT_ORDER = built.order as readonly StoryStageId[];

export const STORY_BEATS = built.windows;

export const storyBeat = (id: StoryStageId): StoryBeatWindow =>
  STORY_BEATS[id];

/** Timeline units → scroll progress. */
export const beatProgress = (time: number): number =>
  time / STORY_TIMELINE_DURATION;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

/**
 * How present a beat is at a given progress: 0 before it arrives, 1 across the
 * whole settled plateau, 0 again once it has left. The phase rail and the route
 * overlays both read from this, so a label is at full strength for exactly as long
 * as the beat it names is on screen.
 */
export function beatWeight(beat: StoryBeatWindow, progress: number): number {
  if (progress < beat.startP || progress > beat.endP) return 0;
  if (progress < beat.settleP) {
    return smooth(
      clamp01((progress - beat.startP) / Math.max(1e-5, beat.settleP - beat.startP)),
    );
  }
  if (progress <= beat.exitP) return 1;
  return (
    1 -
    smooth(clamp01((progress - beat.exitP) / Math.max(1e-5, beat.endP - beat.exitP)))
  );
}
