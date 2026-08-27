import { createContext, useContext, useRef, ReactNode, useEffect } from "react";
import * as THREE from "three";

export type Coordinate = { x: number; y: number };

export type AnchorRegistry = {
  [id: string]: Coordinate;
};

type Subscriber = (anchors: AnchorRegistry) => void;

class AnchorController {
  private anchors: AnchorRegistry = {};
  private subscribers: Set<Subscriber> = new Set();
  
  private stageElement: HTMLElement | null = null;
  private stageRect: DOMRect | null = null;
  private domRegistrations = new Map<string, HTMLElement>();

  setStageElement(el: HTMLElement | null) {
    this.stageElement = el;
    this.updateCachedRects();
  }

  registerDOM(id: string, el: HTMLElement | null) {
    if (el) {
      this.domRegistrations.set(id, el);
    } else {
      this.domRegistrations.delete(id);
      if (this.anchors[id]) {
        delete this.anchors[id];
        this.notify();
      }
    }
  }

  updateCachedRects() {
    if (this.stageElement) {
      this.stageRect = this.stageElement.getBoundingClientRect();
    } else {
      this.stageRect = null;
    }
  }

  syncDOM() {
    let changed = false;
    this.updateCachedRects();
    
    if (!this.stageRect) return;

    this.domRegistrations.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2 - this.stageRect!.left;
      const y = rect.top + rect.height / 2 - this.stageRect!.top;
      
      const existing = this.anchors[id];
      if (!existing || Math.abs(existing.x - x) > 0.25 || Math.abs(existing.y - y) > 0.25) {
        this.anchors[id] = { x, y };
        changed = true;
      }
    });

    if (changed) {
      this.notify();
    }
  }

  getStageRect() {
    if (!this.stageRect && this.stageElement) {
       this.stageRect = this.stageElement.getBoundingClientRect();
    }
    return this.stageRect;
  }

  setAnchor(id: string, coordinate: Coordinate | null) {
    if (coordinate) {
      const existing = this.anchors[id];
      if (!existing || Math.abs(existing.x - coordinate.x) > 0.25 || Math.abs(existing.y - coordinate.y) > 0.25) {
        this.anchors[id] = coordinate;
        this.notify();
      }
    } else {
      if (this.anchors[id]) {
        delete this.anchors[id];
        this.notify();
      }
    }
  }

  setAnchors(coordinates: Record<string, Coordinate>) {
    let changed = false;
    Object.entries(coordinates).forEach(([id, coordinate]) => {
      const existing = this.anchors[id];
      if (!existing || Math.abs(existing.x-coordinate.x)>.25 || Math.abs(existing.y-coordinate.y)>.25) {
        this.anchors[id] = coordinate; changed = true;
      }
    });
    if (changed) this.notify();
  }

  getAnchor(id: string): Coordinate | null {
    return this.anchors[id] || null;
  }

  getAllAnchors() {
    return this.anchors;
  }

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach((cb) => cb(this.anchors));
  }
}

const AnchorContext = createContext<AnchorController | null>(null);

export function AnchorProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef(new AnchorController());
  
  useEffect(() => {
    const handleScroll = () => {
      controllerRef.current.syncDOM();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return <AnchorContext.Provider value={controllerRef.current}>{children}</AnchorContext.Provider>;
}

export function useAnchorController() {
  const context = useContext(AnchorContext);
  if (!context) throw new Error("useAnchorController must be used within an AnchorProvider");
  return context;
}

export function useAnchorStage<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const controller = useAnchorController();
  
  useEffect(() => {
    controller.setStageElement(ref.current);
    return () => controller.setStageElement(null);
  }, [controller, ref]);
}
