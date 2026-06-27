/**
 * In-3D coupe drag-handle + cutting-line overlay (spec v1.0.1 Feature B). Renders, in the live 3D
 * member frame (mm, member axis +Y): for every cut a translucent cut-plane + a cutting-line + an
 * auto tag (A-A, B-B…), and for the ACTIVE editable cut a draggable handle that slides the cut
 * along the member axis. The handle writes the SAME `updateCut(id,{origin})` the numeric station
 * field writes (one source of truth, §2.4); the numeric + keyboard path stays the a11y baseline.
 *
 * This is GPU/interaction-only — it reads core's pure `sectionAt` output and writes a `SectionCut`;
 * no engine/`.rcfg` change (§2.5). Mounted INSIDE the member group, so its local frame is mm with
 * the axis along +Y regardless of the element-aware group rotation (Feature A).
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Line, Html, DragControls } from "@react-three/drei";
import { useStore } from "../store/useStore";
import { sectionAt, type SectionCut, type SolveResult } from "@rebarconfig/core";
import { clampStation, snapStation, memberHalfExtents, snapStationsFor } from "./coupeHandle";

const PLANE_COLOR = "#4fc3f7";

function CutVisual({
  cut,
  result,
  halfW,
  halfH,
  active,
  wrapper,
  snapStations,
}: {
  cut: SectionCut;
  result: SolveResult;
  halfW: number;
  halfH: number;
  active: boolean;
  wrapper: React.RefObject<THREE.Group>;
  snapStations: number[];
}) {
  const updateCut = useStore((s) => s.updateCut);
  const setDragMode = useStore((s) => s.setDragMode);
  const handleRef = useRef<THREE.Mesh>(null);
  const station = (cut.origin as { y: number }).y;
  const tag = useMemo(() => sectionAt(result, cut).elevation.tag, [result, cut]);
  const editable = !cut.isDefault;

  const onDrag = () => {
    if (!handleRef.current || !wrapper.current) return;
    const world = handleRef.current.getWorldPosition(new THREE.Vector3());
    const local = wrapper.current.worldToLocal(world.clone());
    const y = snapStation(clampStation(local.y, result.member.length), snapStations, 80);
    updateCut(cut.id, { origin: { ...(cut.origin as object), y } as SectionCut["origin"] });
  };

  return (
    <group>
      {/* translucent cut plane (perpendicular to the member axis at the station) */}
      <mesh position={[0, station, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2 * halfW * 1.05, 2 * halfH * 1.05]} />
        <meshBasicMaterial
          color={PLANE_COLOR}
          transparent
          opacity={active ? 0.22 : 0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* cutting line on the front face + the normal (viewing-direction) arrow */}
      <Line
        points={[
          [-halfW * 1.2, station, halfH],
          [halfW * 1.2, station, halfH],
        ]}
        color={PLANE_COLOR}
        lineWidth={active ? 2.5 : 1.2}
        dashed
        dashSize={40}
        gapSize={25}
      />
      <Html position={[halfW * 1.25, station, halfH]} center distanceFactor={2000}>
        <span className="coupe-tag">{tag}</span>
      </Html>
      {/* draggable handle — only the active, non-default cut is grabbable (§2.2) */}
      {active && editable && (
        <DragControls
          axisLock="y"
          onDragStart={() => setDragMode(true)}
          onDrag={onDrag}
          onDragEnd={() => setDragMode(false)}
        >
          <mesh ref={handleRef} position={[0, station, halfH * 1.2]}>
            <sphereGeometry args={[Math.max(20, halfW * 0.18), 16, 16]} />
            <meshStandardMaterial color="#ffd54f" />
          </mesh>
        </DragControls>
      )}
    </group>
  );
}

/** All cut overlays for the active element. Mount INSIDE the member (mm, axis +Y) group. */
export function CoupeHandles() {
  const cuts = useStore((s) => s.cuts);
  const activeCutId = useStore((s) => s.activeCutId);
  const result = useStore((s) => s.result);
  const showSection = useStore((s) => s.showSection);
  const wrapper = useRef<THREE.Group>(null);
  const { halfW, halfH } = memberHalfExtents(result.member);
  const snapStations = useMemo(() => snapStationsFor(result), [result]);

  if (!showSection) return null; // overlays follow the existing Coupe toggle (§8)

  return (
    <group ref={wrapper}>
      {cuts.map((cut) => (
        <CutVisual
          key={cut.id}
          cut={cut}
          result={result}
          halfW={halfW}
          halfH={halfH}
          active={cut.id === activeCutId}
          wrapper={wrapper}
          snapStations={snapStations}
        />
      ))}
    </group>
  );
}
