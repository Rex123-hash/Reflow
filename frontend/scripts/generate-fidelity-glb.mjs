import fs from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

class NodeFileReader {
  result = null;
  onloadend = null;
  onerror = null;

  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer();
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }

  async readAsDataURL(blob) {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type};base64,${buffer.toString("base64")}`;
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }
}

globalThis.FileReader ??= NodeFileReader;

const ivory = new THREE.MeshPhysicalMaterial({
  name: "Matte ivory ceramic",
  color: "#eee8dc",
  roughness: 0.68,
  metalness: 0,
  clearcoat: 0.08,
  clearcoatRoughness: 0.72,
});

const ivoryHigh = new THREE.MeshPhysicalMaterial({
  name: "Raised ivory plate",
  color: "#f8f3e9",
  roughness: 0.62,
  metalness: 0,
  clearcoat: 0.1,
  clearcoatRoughness: 0.7,
});

const seam = new THREE.MeshStandardMaterial({
  name: "Recess seam",
  color: "#b8b0a2",
  roughness: 0.88,
  metalness: 0,
});

const forest = new THREE.MeshPhysicalMaterial({
  name: "Forest fitted insert",
  color: "#173d2e",
  roughness: 0.3,
  metalness: 0.08,
  clearcoat: 0.2,
  clearcoatRoughness: 0.42,
});

const brass = new THREE.MeshPhysicalMaterial({
  name: "Brushed brass hardware",
  color: "#b89a64",
  roughness: 0.24,
  metalness: 0.84,
  clearcoat: 0.1,
  clearcoatRoughness: 0.3,
});

function lathedMesh(name, profile, material, segments = 192) {
  const points = profile.map(
    ([radius, height]) => new THREE.Vector2(radius, height),
  );
  const geometry = new THREE.LatheGeometry(points, segments);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

function ringSegmentGeometry({
  inner,
  outer,
  bottom,
  top,
  start,
  end,
  segments = 144,
  bevel = 0.055,
}) {
  const profile = [
    [inner + bevel, bottom],
    [inner, bottom + bevel],
    [inner, top - bevel],
    [inner + bevel, top],
    [outer - bevel, top],
    [outer, top - bevel],
    [outer, bottom + bevel],
    [outer - bevel, bottom],
  ];
  const positions = [];
  const indices = [];
  const profileCount = profile.length;

  for (let segmentIndex = 0; segmentIndex <= segments; segmentIndex += 1) {
    const t = segmentIndex / segments;
    const angle = THREE.MathUtils.lerp(start, end, t);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const [radius, y] of profile) {
      positions.push(cos * radius, y, sin * radius);
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

  for (const [isEnd, angle, row] of [
    [false, start, 0],
    [true, end, segments * profileCount],
  ]) {
    const centerIndex = positions.length / 3;
    const centerRadius = (inner + outer) / 2;
    positions.push(
      Math.cos(angle) * centerRadius,
      (bottom + top) / 2,
      Math.sin(angle) * centerRadius,
    );
    for (let profileIndex = 0; profileIndex < profileCount; profileIndex += 1) {
      const nextProfile = (profileIndex + 1) % profileCount;
      if (isEnd)
        indices.push(centerIndex, row + profileIndex, row + nextProfile);
      else indices.push(centerIndex, row + nextProfile, row + profileIndex);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function brassPinGeometry() {
  const stem = new THREE.CylinderGeometry(0.062, 0.07, 0.075, 48);
  stem.translate(0, 0.032, 0);
  const head = new THREE.SphereGeometry(
    0.105,
    64,
    32,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.6,
  );
  head.translate(0, 0.055, 0);
  return mergeGeometries([stem, head], false);
}

const root = new THREE.Group();
root.name = "ReflowFidelitySlice";

root.add(
  lathedMesh(
    "CeramicBody",
    [
      [0, -0.24],
      [2.54, -0.24],
      [2.64, -0.2],
      [2.72, -0.1],
      [2.75, 0.015],
      [2.72, 0.095],
      [2.64, 0.15],
      [0, 0.15],
    ],
    ivory,
  ),
);

root.add(
  lathedMesh(
    "RecessedPlate",
    [
      [0, 0.145],
      [2.02, 0.145],
      [2.11, 0.17],
      [2.16, 0.225],
      [2.12, 0.285],
      [2.04, 0.31],
      [0, 0.31],
    ],
    ivoryHigh,
  ),
);

const seamMesh = new THREE.Mesh(
  new THREE.TorusGeometry(2.2, 0.024, 20, 192),
  seam,
);
seamMesh.name = "RecessSeam";
seamMesh.rotation.x = Math.PI / 2;
seamMesh.position.y = 0.2;
root.add(seamMesh);

const insert = new THREE.Mesh(
  ringSegmentGeometry({
    inner: 1.52,
    outer: 1.91,
    bottom: 0.27,
    top: 0.45,
    start: -0.26,
    end: 2.35,
  }),
  forest,
);
insert.name = "ForestInsert";
root.add(insert);

const pinGeometry = brassPinGeometry();
for (const [name, angle, radius] of [
  ["BrassPinA", 0.18, 1.72],
  ["BrassPinB", 2.08, 1.72],
]) {
  const pin = new THREE.Mesh(pinGeometry.clone(), brass);
  pin.name = name;
  pin.position.set(Math.cos(angle) * radius, 0.445, Math.sin(angle) * radius);
  root.add(pin);
}

root.traverse((object) => {
  if (object.isMesh) {
    object.castShadow = true;
    object.receiveShadow = true;
  }
});

const scene = new THREE.Scene();
scene.add(root);

const exporter = new GLTFExporter();
const binary = await new Promise((resolve, reject) => {
  exporter.parse(scene, resolve, reject, {
    binary: true,
    trs: true,
    onlyVisible: true,
  });
});

const outputDir = path.resolve("public/models");
await fs.mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "reflow-fidelity-slice.glb");
await fs.writeFile(outputPath, Buffer.from(binary));

const triangleCount = root.children.reduce((count, object) => {
  if (!object.isMesh) return count;
  const geometry = object.geometry;
  return (
    count +
    (geometry.index
      ? geometry.index.count / 3
      : geometry.attributes.position.count / 3)
  );
}, 0);

console.log(
  JSON.stringify(
    {
      outputPath,
      bytes: Buffer.byteLength(Buffer.from(binary)),
      meshCount: root.children.filter((object) => object.isMesh).length,
      triangleCount,
      namedParts: root.children.map((object) => object.name),
    },
    null,
    2,
  ),
);
