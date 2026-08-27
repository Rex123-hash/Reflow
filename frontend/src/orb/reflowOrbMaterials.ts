import { useEffect, useMemo } from "react";
import * as THREE from "three";

export const REFLOW_MATERIALS = {
  ceramicBase: {
    color: "#e8dfd2",
    roughness: 0.76,
    metalness: 0,
    clearcoat: 0.012,
    clearcoatRoughness: 0.94,
  },
  ceramicTop: {
    color: "#f2eadf",
    roughness: 0.74,
    metalness: 0,
    clearcoat: 0.015,
    clearcoatRoughness: 0.92,
  },
  ceramicHighlight: {
    color: "#f8f1e6",
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.015,
    clearcoatRoughness: 0.82,
  },
  forestInsert: {
    color: "#29463b",
    roughness: 0.68,
    metalness: 0.015,
    clearcoat: 0.012,
    clearcoatRoughness: 0.9,
  },
  brass: {
    color: "#c5a15f",
    roughness: 0.38,
    metalness: 0.74,
    anisotropy: 0.14,
    anisotropyRotation: 0.35,
    clearcoat: 0.015,
    clearcoatRoughness: 0.84,
  },
  sage: {
    color: "#aeb8a5",
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.055,
    clearcoatRoughness: 0.76,
  },
} as const;

function seededNoise(index: number) {
  const value = Math.sin(index * 91.733 + 17.13) * 43758.5453;
  return value - Math.floor(value);
}

export function useReflowSurfaceMaps() {
  const textures = useMemo(() => {
    const size = 256;
    const bumpData = new Uint8Array(size * size * 4);
    const colorData = new Uint8Array(size * size * 4);
    const roughnessData = new Uint8Array(size * size * 4);
    for (let index = 0; index < size * size; index += 1) {
      const x = index % size;
      const y = Math.floor(index / size);
      const fine = seededNoise(index);
      const mineral = Math.sin(x * 0.047 + Math.sin(y * 0.019)) * Math.cos(y * 0.041);
      const broad = Math.sin((x + y) * 0.014) * 0.5 + Math.cos((x - y) * 0.011) * 0.5;
      const offset = index * 4;
      const bump = Math.round(126 + (fine - 0.5) * 13 + mineral * 5.5 + broad * 2.5);
      const tone = Math.round(244 + (fine - 0.5) * 5 + broad * 3.2 + mineral * 1.8);
      const roughness = Math.round(224 + broad * 19 + mineral * 7 + (fine - 0.5) * 5);
      for (let channel = 0; channel < 3; channel += 1) {
        bumpData[offset + channel] = bump;
        colorData[offset + channel] = tone;
        roughnessData[offset + channel] = roughness;
      }
      bumpData[offset + 3] = colorData[offset + 3] = roughnessData[offset + 3] = 255;
    }
    const makeTexture = (data: Uint8Array, colorSpace: THREE.ColorSpace = THREE.NoColorSpace) => {
      const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2.35, 2.35);
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.generateMipmaps = true;
      texture.colorSpace = colorSpace;
      texture.needsUpdate = true;
      return texture;
    };
    return {
      bump: makeTexture(bumpData),
      color: makeTexture(colorData, THREE.SRGBColorSpace),
      roughness: makeTexture(roughnessData),
    };
  }, []);

  useEffect(() => () => Object.values(textures).forEach((texture) => texture.dispose()), [textures]);
  return textures;
}
