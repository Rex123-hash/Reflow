import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbPose } from "../story/storyTypes";

interface PlaceholderOrbSceneProps {
  pose: MutableRefObject<OrbPose>;
  registerInvalidator: (invalidate: (() => void) | null) => void;
  reducedMotion: boolean;
}

function SceneInvalidator({
  register,
}: {
  register: (invalidate: (() => void) | null) => void;
}) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    register(invalidate);
    return () => register(null);
  }, [invalidate, register]);
  return null;
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  const signalled = useRef(false);
  useFrame(() => {
    if (!signalled.current) {
      signalled.current = true;
      onReady();
    }
  });
  return null;
}

function BrassPin({ angle, radius }: { angle: number; radius: number }) {
  return (
    <mesh position={[Math.cos(angle) * radius, 0.35, Math.sin(angle) * radius]} castShadow>
      <sphereGeometry args={[0.085, 16, 16]} />
      <meshStandardMaterial color="#b89a64" metalness={0.68} roughness={0.3} />
    </mesh>
  );
}

function SageNode({ angle, radius, size = 0.22 }: { angle: number; radius: number; size?: number }) {
  return (
    <mesh position={[Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius]} castShadow>
      <sphereGeometry args={[size, 22, 22]} />
      <meshStandardMaterial color="#a9b29a" roughness={0.64} />
    </mesh>
  );
}

function PlaceholderOrb({ pose }: { pose: MutableRefObject<OrbPose> }) {
  const group = useRef<THREE.Group>(null);
  const alertMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const verifiedMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const outerRing = useRef<THREE.Mesh>(null);
  const innerRing = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const value = pose.current;
    if (group.current) {
      group.current.position.set(value.x, value.y, 0);
      group.current.rotation.y = value.yaw;
      group.current.rotation.z = value.tilt;
      group.current.scale.setScalar(value.scale);
    }
    if (outerRing.current) outerRing.current.position.y = 0.22 + value.ringSpread * 0.18;
    if (innerRing.current) innerRing.current.rotation.z = value.ringSpread * 0.32;
    if (alertMaterial.current) {
      alertMaterial.current.color.lerpColors(
        new THREE.Color("#1d4c39"),
        new THREE.Color("#a76658"),
        value.alert,
      );
    }
    if (verifiedMaterial.current) {
      verifiedMaterial.current.color.lerpColors(
        new THREE.Color("#17211c"),
        new THREE.Color("#1d4c39"),
        value.verified,
      );
    }
  });

  return (
    <group ref={group} rotation-x={0}>
      <mesh position={[0, -0.13, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.25, 2.35, 0.34, 72]} />
        <meshStandardMaterial color="#e9e3d6" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.12, 2.12, 0.16, 72]} />
        <meshStandardMaterial color="#f7f2e8" roughness={0.67} />
      </mesh>
      <mesh ref={outerRing} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.72, 0.14, 18, 72, Math.PI * 1.62]} />
        <meshStandardMaterial ref={alertMaterial} color="#1d4c39" roughness={0.38} metalness={0.12} />
      </mesh>
      <mesh ref={innerRing} position={[0, 0.24, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.37, 0.045, 12, 64, Math.PI * 1.45]} />
        <meshStandardMaterial color="#91a995" roughness={0.44} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.82, 0.9, 0.28, 64]} />
        <meshStandardMaterial color="#f6f1e7" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.43, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.18, 48]} />
        <meshStandardMaterial ref={verifiedMaterial} color="#17211c" roughness={0.38} />
      </mesh>
      <BrassPin angle={0.2} radius={1.78} />
      <BrassPin angle={2.0} radius={1.78} />
      <BrassPin angle={3.85} radius={1.78} />
      <BrassPin angle={5.2} radius={1.06} />
      <SageNode angle={0.4} radius={2.68} size={0.25} />
      <SageNode angle={2.55} radius={2.58} size={0.21} />
      <SageNode angle={4.5} radius={2.72} size={0.18} />
    </group>
  );
}

export function PlaceholderOrbScene({
  pose,
  registerInvalidator,
  reducedMotion,
}: PlaceholderOrbSceneProps) {
  const [ready, setReady] = useState(false);

  return (
    <div className={`orb-layer ${ready ? "is-ready" : "is-loading"}`} aria-hidden="true">
      <div className="orb-poster">
        <span className="poster-ring poster-ring-outer" />
        <span className="poster-ring poster-ring-inner" />
        <span className="poster-hub" />
      </div>
      <Canvas
        className="orb-canvas"
        shadows
        dpr={[1, 1.5]}
        frameloop={reducedMotion ? "demand" : "demand"}
        camera={{ position: [0, 7.6, 8.4], fov: 32, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#f6f3ea"]} />
        <ambientLight intensity={1.65} />
        <directionalLight
          castShadow
          position={[-4, 9, 6]}
          intensity={2.4}
          color="#fffaf0"
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[6, 4, -3]} intensity={0.85} color="#dfe8de" />
        <mesh position={[0, -1.02, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial color="#17211c" opacity={0.12} />
        </mesh>
        <PlaceholderOrb pose={pose} />
        <SceneInvalidator register={registerInvalidator} />
        <ReadySignal onReady={() => setReady(true)} />
      </Canvas>
    </div>
  );
}
