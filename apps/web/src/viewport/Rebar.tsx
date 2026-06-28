/**
 * Dumb renderer of ONE solved bar (a BarInstance from buildScene). Tube in full fidelity;
 * a plain line in drag-degradation mode (§2.2). Colour encodes validity (§8): FAIL → absolute
 * RED, selected (clicked alert) → cyan highlight, else steel grey. No geometry math here — the
 * polyline is the engine's centerline, only turned into a mesh.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { BarInstance, RenderMode } from "./rebarProps";

const STEEL = "#8a8f98";
const FAIL = "#ff1e1e";
const SELECTED = "#22d3ee";

function colorFor(bar: BarInstance): string {
  if (bar.failing) return FAIL;
  if (bar.selected) return SELECTED;
  return STEEL;
}

function toVecs(points: number[]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i += 3) {
    out.push(new THREE.Vector3(points[i]!, points[i + 1]!, points[i + 2]!));
  }
  return out;
}

export function Rebar({ bar, mode, onPick }: { bar: BarInstance; mode: RenderMode; onPick?: () => void }) {
  const color = colorFor(bar);
  const pts = useMemo(() => toVecs(bar.points), [bar.points]);

  const tube = useMemo(() => {
    if (mode !== "tubes" || pts.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(pts, bar.closed, "catmullrom", 0.0);
    const segments = Math.max(8, pts.length * 6);
    return new THREE.TubeGeometry(curve, segments, bar.diameter / 2, 8, bar.closed);
  }, [pts, bar.closed, bar.diameter, mode]);

  // F7: longitudinal bars carry an onPick → clicking the mesh selects that bar (raycast = the bar).
  const pickProps = onPick
    ? {
        onPointerDown: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          onPick();
        },
      }
    : {};

  if (mode === "tubes" && tube) {
    return (
      <mesh geometry={tube} {...pickProps}>
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
    );
  }

  // degradation path: centreline only (LineSegments-equivalent)
  return <Line points={pts.length >= 2 ? pts : [new THREE.Vector3(), new THREE.Vector3()]} color={color} lineWidth={1.5} {...pickProps} />;
}
