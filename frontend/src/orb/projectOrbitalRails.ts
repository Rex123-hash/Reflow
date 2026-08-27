import * as THREE from "three";
import { REFLOW_ORB_DIMENSIONS } from "./reflowOrbGeometry";

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface RailSample extends ProjectedPoint {
  angle: number;
  isRear: boolean;
}

export interface ProjectionRects {
  canvas: DOMRect;
  stage: DOMRect;
}

export function projectOrbLocalPoint(
  localPoint: THREE.Vector3,
  orb: THREE.Object3D,
  camera: THREE.Camera,
  rects: ProjectionRects,
  target = new THREE.Vector3(),
  updateWorldMatrix = true,
): ProjectedPoint {
  if (updateWorldMatrix) orb.updateWorldMatrix(true, false);
  target.copy(localPoint).applyMatrix4(orb.matrixWorld).project(camera);
  const clientX = rects.canvas.left + (target.x * 0.5 + 0.5) * rects.canvas.width;
  const clientY = rects.canvas.top + (-target.y * 0.5 + 0.5) * rects.canvas.height;
  return { x: clientX - rects.stage.left, y: clientY - rects.stage.top };
}

export function projectRail(
  radius: number,
  orb: THREE.Object3D,
  camera: THREE.Camera,
  rects: ProjectionRects,
  samples = 112,
): RailSample[] {
  const local = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const result: RailSample[] = [];
  orb.updateWorldMatrix(true, false);
  for (let index = 0; index <= samples; index += 1) {
    const angle = (index / samples) * Math.PI * 2;
    local.set(
      Math.cos(angle) * radius,
      REFLOW_ORB_DIMENSIONS.railPlaneHeight,
      Math.sin(angle) * radius,
    );
    const point = projectOrbLocalPoint(local, orb, camera, rects, projected, false);
    result.push({ ...point, angle, isRear: Math.sin(angle) < 0 });
  }
  return result;
}

export function pointsToSvgPath(points: ReadonlyArray<ProjectedPoint>, close = false): string {
  if (points.length === 0) return "";
  const commands = points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
  );
  if (close) commands.push("Z");
  return commands.join(" ");
}

export function splitRailDepth(samples: ReadonlyArray<RailSample>) {
  const rear = samples.filter((sample) => sample.isRear);
  const front = samples.filter((sample) => !sample.isRear);
  return { rear, front };
}

export function localRailPoint(
  radius: number,
  angle: number,
  height: number = REFLOW_ORB_DIMENSIONS.railPlaneHeight,
) {
  return new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
}
