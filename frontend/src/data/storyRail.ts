import {
  STORY_BEATS,
  SUB_BEAT_HANDOVER,
  type StoryStageId,
  type StoryBeatWindow,
} from "./storySchedule";

/**
 * The story rail's model: presentation metadata only.
 *
 * Deliberately not in `proofManifest.ts`. That file carries the frozen Calendar
 * proof — a milestone commit, receipt identifiers, recorded timestamps — and
 * presentation labels have no business sitting beside recorded truth even though
 * nothing currently validates the file.
 *
 * Two layers, and the rail shows both:
 *
 *   the five-word operational vocabulary — OBJECTIVE, DETECT, PLAN, ACT, VERIFY —
 *   which is the *cycle* Reflow runs;
 *
 *   the actual story states, which are more numerous than the vocabulary because
 *   recovery loops. PLAN and ACT run a second time, VERIFY happens twice, and
 *   RECOVERY INCOMPLETE and RESTORED are outcomes rather than phases.
 *
 * Collapsing the second list into the first would erase the exact thing the
 * product exists to demonstrate: that a verified action is not a recovered
 * objective. So RESTORED is its own terminal outcome and is never labelled as
 * just another VERIFY.
 *
 * States are more numerous than beats — the ACT beat contains both the action and
 * its independent read-back, and the REPLAN beat contains replanning, the new
 * action and the second verification. Each state therefore owns a slice of its
 * beat's window, which is what lets the rail advance *inside* a beat instead of
 * jumping once per beat.
 */

/** Reflow's five-word operational cycle. Nothing else belongs in this list. */
export type RailPhase = "Objective" | "Detect" | "Plan" | "Act" | "Verify";

export interface RailState {
  id: string;
  /** The beat whose window this state lives inside. */
  beat: StoryStageId;
  /**
   * The operational phase this state is an instance of, or null when the state is
   * an outcome rather than a phase.
   *
   * RESTORED is deliberately not "Verify". Verification is the process; restored
   * is the proven result of one. Labelling the end of the story as another VERIFY
   * would erase the distinction the whole product rests on.
   */
  phase: RailPhase | null;
  /** Which pass through the recovery cycle, for the phases that recur. */
  attempt?: 1 | 2;
  label: string;
  /** An outcome of a phase rather than a phase: shown under an OUTCOME kicker. */
  outcome?: true;
}

/**
 * Ten states, not five.
 *
 * The five-word vocabulary is the recurring *cycle*; the recovery story has more
 * states than the cycle has words because the cycle runs twice and because two of
 * the story's most important moments — RECOVERY INCOMPLETE and RESTORED — are
 * outcomes of a VERIFY rather than phases in their own right.
 */
export const RAIL_STATES: readonly RailState[] = [
  {
    id: "objective",
    beat: "hero",
    phase: "Objective",
    label: "Objective protected",
  },
  { id: "detect", beat: "risk", phase: "Detect", label: "Disruption and impact" },
  { id: "plan", beat: "futures", phase: "Plan", attempt: 1, label: "Recovery futures" },
  { id: "act", beat: "action", phase: "Act", attempt: 1, label: "Real action" },
  {
    id: "verify",
    beat: "action",
    phase: "Verify",
    attempt: 1,
    label: "Independent verification",
  },
  // The outcome of the first verification: the action was real and read back, and
  // the objective is still not recovered.
  {
    id: "incomplete",
    beat: "incomplete",
    phase: "Verify",
    attempt: 1,
    label: "Recovery incomplete",
    outcome: true,
  },
  { id: "replan", beat: "replan", phase: "Plan", attempt: 2, label: "Replanning" },
  { id: "act-2", beat: "replan", phase: "Act", attempt: 2, label: "New action" },
  {
    id: "verify-2",
    beat: "replan",
    phase: "Verify",
    attempt: 2,
    label: "Verify again",
  },
  // The terminal outcome. Not a phase, and never labelled as one.
  { id: "restored", beat: "restored", phase: null, label: "Restored", outcome: true },
] as const;

/**
 * The small kicker above a rail state: the operational phase it instantiates and,
 * where the cycle recurs, which pass this is. Outcomes say so instead.
 */
export function railKicker(state: RailState): string {
  if (state.outcome && !state.phase) return "Outcome";
  if (state.outcome) return `${state.phase} · Outcome`;
  if (state.attempt === 2) return `${state.phase} · Attempt 2`;
  return state.phase ?? "";
}

export interface RailWindow {
  state: RailState;
  /** Progress at which this state becomes the current one. */
  fromP: number;
  /** Progress at which the next state takes over. */
  toP: number;
}

/**
 * Slices each beat's window between the states it owns.
 *
 * A state becomes current partway through its beat's arrival and stays current
 * until the next state's turn, so a beat that contains three story states walks
 * the rail three notches while the reader watches those three things happen.
 */
function buildWindows(): readonly RailWindow[] {
  const byBeat = new Map<StoryStageId, RailState[]>();
  for (const state of RAIL_STATES) {
    const list = byBeat.get(state.beat) ?? [];
    list.push(state);
    byBeat.set(state.beat, list);
  }

  const windows: RailWindow[] = [];
  for (const [beatId, states] of byBeat) {
    const beat: StoryBeatWindow = STORY_BEATS[beatId];
    const span = beat.endP - beat.startP;
    // Handover points come from the schedule, so the rail changes at exactly the
    // moment that state's evidence arrives on screen. An even split would put the
    // label change near the composition change but not on it, which is what made
    // VERIFY read as a label flashing past a static card.
    const handover =
      SUB_BEAT_HANDOVER[beatId] ??
      states.map((_, index) => index / states.length);
    states.forEach((state, index) => {
      windows.push({
        state,
        fromP: beat.startP + span * handover[index],
        toP:
          index + 1 < states.length
            ? beat.startP + span * handover[index + 1]
            : // The last state of a beat stays current right up to the first
              // state of the next one.
              beat.endP,
      });
    });
  }
  return windows;
}

export const RAIL_WINDOWS = buildWindows();

/** Index of the state that is current at a given scroll progress. */
export function railIndexAt(progress: number): number {
  for (let index = RAIL_WINDOWS.length - 1; index >= 0; index -= 1) {
    if (progress >= RAIL_WINDOWS[index].fromP) return index;
  }
  return 0;
}
