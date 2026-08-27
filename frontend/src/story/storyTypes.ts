import type { StoryStageId } from "../data/proofManifest";

export interface OrbPose {
  x: number;
  y: number;
  scale: number;
  yaw: number;
  tilt: number;
  ringSpread: number;
  alert: number;
  verified: number;
}

export interface StoryController {
  progress: { current: number };
  pose: { current: OrbPose };
  activeStage: StoryStageId;
  reducedMotion: boolean;
  captureFrame: StoryStageId | null;
  captureProgress: number | null;
  registerInvalidator: (invalidate: (() => void) | null) => void;
}

export const INITIAL_ORB_POSE: OrbPose = {
  x: 0,
  y: 2.7,
  scale: 0.38,
  yaw: -0.15,
  tilt: 0,
  ringSpread: 0,
  alert: 0,
  verified: 0,
};
