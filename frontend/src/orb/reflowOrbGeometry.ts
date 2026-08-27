import * as THREE from "three";

export const REFLOW_ORB_DIMENSIONS = {
  bodyRadius: 2.72,
  bodyHeight: 0.36,
  topPlateRadius: 2.46,
  topPlateHeight: 0.17,
  seamRadius: 2.18,
  trackInnerRadius: 2.04,
  trackOuterRadius: 2.4,
  trackBottom: 0.333,
  trackTop: 0.403,
  trackBevel: 0.018,
  pedestalRadius: 0.94,
  pedestalTopRadius: 0.63,
  objectiveHubRadius: 0.16,
  railPlaneHeight: 0.22,
} as const;

export const REFLOW_ORB_RAILS = {
  nearInner: REFLOW_ORB_DIMENSIONS.bodyRadius * 1.08,
  nearMiddle: REFLOW_ORB_DIMENSIONS.bodyRadius * 1.21,
  nearOuter: REFLOW_ORB_DIMENSIONS.bodyRadius * 1.34,
  outerInner: REFLOW_ORB_DIMENSIONS.bodyRadius * 1.69,
  outerOuter: REFLOW_ORB_DIMENSIONS.bodyRadius * 1.93,
} as const;

export const REFLOW_ORB_ANCHORS = {
  objectiveHub: new THREE.Vector3(0, 0.552, 0),
  recoveryTrackTangent: polarPoint(REFLOW_ORB_DIMENSIONS.trackOuterRadius, -0.16, 0.418),
  impactSource: polarPoint(REFLOW_ORB_RAILS.nearMiddle, Math.PI * 1.08, 0.22),
  futureA: polarPoint(REFLOW_ORB_RAILS.nearOuter, Math.PI * 1.23, 0.22),
  futureB: polarPoint(REFLOW_ORB_RAILS.nearOuter, Math.PI * 0.5, 0.22),
  futureC: polarPoint(REFLOW_ORB_RAILS.nearOuter, -0.23, 0.22),
  actionExit: polarPoint(REFLOW_ORB_DIMENSIONS.trackOuterRadius, -0.32, 0.418),
} as const;

export const TRACK_SEGMENTS = [
  { id: "primary-a", start: -0.34, end: 1.43 },
  { id: "primary-b", start: 1.7, end: 2.4 },
  { id: "index", start: 2.69, end: 3.12 },
  { id: "return", start: 4.54, end: 6.08 },
] as const;

export const OUTER_TRACK_SEGMENTS = [
  { id: "outer-primary-a", start: -0.28, end: 1.4 },
  { id: "outer-primary-b", start: 1.72, end: 2.3 },
  { id: "outer-return", start: 4.62, end: 6.02 },
] as const;

export const RADIAL_SEAM_ANGLES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5] as const;

export const BRASS_PIN_PLACEMENTS = [
  { angle: -0.18, radius: 2.2 },
  { angle: 0.92, radius: 2.18 },
  { angle: 2.14, radius: 2.2 },
  { angle: 3.0, radius: 2.18 },
  { angle: 4.78, radius: 2.2 },
] as const;

export const SATELLITE_PLACEMENTS = [
  { angle: -0.46, radius: 3.48, size: 0.215 },
  { angle: 2.56, radius: 3.56, size: 0.187 },
  { angle: 4.02, radius: 3.42, size: 0.15 },
] as const;

export function polarPoint(radius: number, angle: number, height: number) {
  return new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
}

export function createTrackSegmentGeometry(
  start: number,
  end: number,
  segments = 120,
): THREE.BufferGeometry {
  const {
    trackInnerRadius: inner,
    trackOuterRadius: outer,
    trackBottom: bottom,
    trackTop: top,
    trackBevel: bevel,
  } = REFLOW_ORB_DIMENSIONS;
  return createFittedArcGeometry({ inner, outer, bottom, top, bevel, start, end, segments });
}

export interface FittedArcOptions {
  inner: number;
  outer: number;
  bottom: number;
  top: number;
  bevel: number;
  start: number;
  end: number;
  segments?: number;
}

export function createFittedArcGeometry({
  inner,
  outer,
  bottom,
  top,
  bevel,
  start,
  end,
  segments = 96,
}: FittedArcOptions): THREE.BufferGeometry {
  const profile: ReadonlyArray<readonly [number, number]> = [
    [inner + bevel, bottom],
    [inner, bottom + bevel],
    [inner, top - bevel],
    [inner + bevel, top],
    [outer - bevel, top],
    [outer, top - bevel],
    [outer, bottom + bevel],
    [outer - bevel, bottom],
  ];
  const positions: number[] = [];
  const indices: number[] = [];
  const profileCount = profile.length;

  for (let segmentIndex = 0; segmentIndex <= segments; segmentIndex += 1) {
    const angle = THREE.MathUtils.lerp(start, end, segmentIndex / segments);
    for (const [radius, height] of profile) {
      positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    }
  }

  for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
    const row = segmentIndex * profileCount;
    const nextRow = (segmentIndex + 1) * profileCount;
    for (let profileIndex = 0; profileIndex < profileCount; profileIndex += 1) {
      const nextProfile = (profileIndex + 1) % profileCount;
      const a = row + profileIndex;
      const b = nextRow + profileIndex;
      const c = nextRow + nextProfile;
      const d = row + nextProfile;
      indices.push(a, b, d, b, c, d);
    }
  }

  for (const [angle, row, reverse] of [
    [start, 0, false],
    [end, segments * profileCount, true],
  ] as const) {
    const centerIndex = positions.length / 3;
    positions.push(
      Math.cos(angle) * ((inner + outer) / 2),
      (bottom + top) / 2,
      Math.sin(angle) * ((inner + outer) / 2),
    );
    for (let profileIndex = 0; profileIndex < profileCount; profileIndex += 1) {
      const nextProfile = (profileIndex + 1) % profileCount;
      if (reverse) indices.push(centerIndex, row + profileIndex, row + nextProfile);
      else indices.push(centerIndex, row + nextProfile, row + profileIndex);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createRadialSeamGeometry(angle: number): THREE.BufferGeometry {
  const start = REFLOW_ORB_DIMENSIONS.pedestalRadius * 1.05;
  const end = REFLOW_ORB_DIMENSIONS.trackInnerRadius * 0.99;
  return new THREE.BufferGeometry().setFromPoints([
    polarPoint(start, angle, 0.342),
    polarPoint(end, angle, 0.342),
  ]);
}
