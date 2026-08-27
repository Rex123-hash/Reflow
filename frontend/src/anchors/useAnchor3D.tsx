import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAnchorController } from "./AnchorSystem";

export function useAnchor3D<T extends THREE.Object3D>(
  id: string, 
  localPosition: [number, number, number] = [0, 0, 0],
  externalRef?: React.RefObject<T | null>
) {
  const internalRef = useRef<T | null>(null);
  const ref = externalRef || internalRef;
  const controller = useAnchorController();
  const { camera, gl } = useThree();
  const localVec = useRef(new THREE.Vector3(...localPosition));
  const worldVec = useRef(new THREE.Vector3());

  useFrame(() => {
    const obj = ref.current;
    if (!obj) return;
    
    const stageRect = controller.getStageRect();
    if (!stageRect) return;

    // Apply local offset relative to the object
    localVec.current.set(localPosition[0], localPosition[1], localPosition[2]);
    
    // Convert local position to world position using object's matrixWorld
    obj.updateWorldMatrix(true, false);
    worldVec.current.copy(localVec.current).applyMatrix4(obj.matrixWorld);
    
    // Project to normalized device coordinates (NDC)
    worldVec.current.project(camera);
    
    // Get exact canvas bounds in client space
    const canvasRect = gl.domElement.getBoundingClientRect();
    
    // NDC to canvas-local coordinates
    const canvasX = (worldVec.current.x * 0.5 + 0.5) * canvasRect.width;
    const canvasY = -(worldVec.current.y * 0.5 - 0.5) * canvasRect.height;
    
    // Convert canvas-local to client space, then to sticky-stage space
    const clientX = canvasRect.left + canvasX;
    const clientY = canvasRect.top + canvasY;
    
    controller.setAnchor(id, { 
      x: clientX - stageRect.left, 
      y: clientY - stageRect.top 
    });
  });

  useEffect(() => {
    return () => {
      controller.setAnchor(id, null);
    };
  }, [id, controller]);

  return ref;
}
