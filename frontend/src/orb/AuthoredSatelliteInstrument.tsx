import { useMemo } from "react";
import * as THREE from "three";

/**
 * The three orbiting bodies.
 *
 * The approved reference shows these as smooth, pale sage-white spheres — no
 * brass, no equatorial channel, no mechanical detailing. An earlier pass here
 * added all three (a forest channel, brass index pin, actuator cap and aperture
 * ring, one per satellite echoing Plan/Act/Verify). It read as authored, but it
 * contradicted the reference: in the approved composition the satellites are
 * deliberately quiet, and their job is to describe an orbit while the central
 * instrument holds every piece of detail. That version is not kept.
 *
 * What was genuinely wrong was the material. They sat at #9ead99 — a mid sage
 * that went muddy and grey once the scene's tone mapping and lighting were
 * corrected, so they read as dull marbles rather than the luminous porcelain
 * beads in the reference. The shell is now a pale sage-white with a soft
 * specular response, which is what gives them presence against the ivory ground.
 *
 * Kept as its own module so the poster capture and the Blender pipeline have one
 * shared definition to mirror.
 */

export type SatelliteKind = "plan" | "act" | "verify";

export interface SatelliteProfile {
  kind: SatelliteKind;
  radius: number;
}

export const SATELLITE_PROFILES: Record<SatelliteKind, SatelliteProfile> = {
  plan: { kind: "plan", radius: 0.19 },
  act: { kind: "act", radius: 0.205 },
  verify: { kind: "verify", radius: 0.2 },
};

/**
 * Pale sage-white porcelain. Read from the reference, which is markedly lighter
 * and more luminous than the mid-sage these used to be.
 */
const SHELL = "#dde2d5";

export function useSatelliteMaterials() {
  return useMemo(
    () => ({
      shell: new THREE.MeshPhysicalMaterial({
        color: SHELL,
        roughness: 0.58,
        metalness: 0,
        // A light coat gives the soft, slightly waxy highlight the reference
        // beads have, without turning them glossy.
        clearcoat: 0.09,
        clearcoatRoughness: 0.52,
        envMapIntensity: 0.72,
      }),
    }),
    [],
  );
}

export function disposeSatelliteMaterials(
  materials: ReturnType<typeof useSatelliteMaterials>,
) {
  materials.shell.dispose();
}

/** One satellite: a smooth sphere, segmented enough to hold a clean terminator. */
export function AuthoredSatelliteInstrument({
  profile,
  materials,
}: {
  profile: SatelliteProfile;
  materials: ReturnType<typeof useSatelliteMaterials>;
}) {
  return (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[profile.radius, 40, 26]} />
      <primitive object={materials.shell} attach="material" />
    </mesh>
  );
}
