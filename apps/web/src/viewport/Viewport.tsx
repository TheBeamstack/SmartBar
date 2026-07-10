/**
 * R3F viewport (spec §2.1, §8): semi-transparent concrete volume + instanced rebar; failing
 * bars recolor absolute RED; OrbitControls; section-cut plane toggle; a perf HUD behind the
 * debug flag. All geometry comes from the engine via buildScene() — this component only orbits,
 * lights, and clips. Units are mm; the whole scene is scaled down for a comfortable camera.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Edges } from "@react-three/drei";
import { useStore } from "../store/useStore";
import { buildScene, type ConcreteEnvelope } from "./rebarProps";
import { Rebar } from "./Rebar";
import { memberGroupRotationFor, rollUpVector, type Vec3 } from "./cameraState";
import { ProjectionRig, ViewController, ViewCubeGizmo, ViewControls } from "./ViewCube";
import { CoupeHandles } from "./CoupeOverlay";
import { steppedStairSpec } from "./steppedStair";

const MM_TO_SCENE = 0.01; // mm → scene units (a 3 m column ≈ 30 units)

// crisp concrete outline edge (G8): a mid-grey line over the transparent volume so it reads as a
// block on the light background (dark enough to stay visible, lighter than the steel bars).
const CONCRETE_COLOR = "#c8ccd2";
const EDGE_COLOR = "#6b7280";

/** The shared transparent concrete material (spec §8: transparent solid so the cage stays legible). */
function concreteMaterial() {
  return (
    <meshStandardMaterial
      color={CONCRETE_COLOR}
      transparent
      opacity={0.3}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );
}

/**
 * G9 ([REF-UI-811b/850], spec §9.1) — in-plane roll applied ON DEMAND, not per-frame. The old F1
 * `useFrame(…, 1)` mutated `camera.up` + `lookAt` every frame, which (with OrbitControls damping)
 * precessed/auto-spun the ViewCube. Now roll is a discrete transform re-applied only when `rollRad`
 * changes, and **starting an orbit/drag auto-levels** the roll to 0 (removing the up-vector conflict).
 */
function RollController() {
  const rollRad = useStore((s) => s.rollRad);
  const setRoll = useStore((s) => s.setRoll);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | (THREE.EventDispatcher & { target?: THREE.Vector3; update?: () => void })
    | null;

  // Apply the roll once, on demand (when rollRad / the camera / the controls change) — no frame loop.
  useEffect(() => {
    if (!controls) return;
    const target = controls.target ?? new THREE.Vector3(0, 0, 0);
    if (!rollRad) {
      camera.up.set(0, 1, 0); // level → world up
    } else {
      const viewDir: Vec3 = [
        camera.position.x - target.x,
        camera.position.y - target.y,
        camera.position.z - target.z,
      ];
      const [ux, uy, uz] = rollUpVector(viewDir, rollRad);
      camera.up.set(ux, uy, uz);
    }
    camera.lookAt(target);
    controls.update?.();
  }, [rollRad, camera, controls]);

  // Auto-level on orbit: the moment the user starts a drag, reset the roll to 0 (spec §9.1).
  useEffect(() => {
    const c = controls as
      | { addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void }
      | null;
    if (!c?.addEventListener) return;
    const onStart = () => {
      if (useStore.getState().rollRad !== 0) setRoll(0);
    };
    c.addEventListener("start", onStart);
    return () => c.removeEventListener?.("start", onStart);
  }, [controls, setRoll]);

  return null;
}

function ConcreteVolume({ concrete }: { concrete: ConcreteEnvelope }) {
  if (concrete.envelope === "CIRCULAR") {
    const r = (concrete.D ?? 600) / 2;
    return (
      <mesh>
        <cylinderGeometry args={[r, r, concrete.length, 48]} />
        {concreteMaterial()}
        <Edges threshold={15} color={EDGE_COLOR} />
      </mesh>
    );
  }
  return (
    <mesh>
      <boxGeometry args={[concrete.b ?? 300, concrete.length, concrete.h ?? 600]} />
      {concreteMaterial()}
      <Edges threshold={15} color={EDGE_COLOR} />
    </mesh>
  );
}

/**
 * G8 (spec §8.1) + D1 (v1.0.4, spec Part V D1) — stepped stair concrete. The engine models the stair
 * as a FLAT rect envelope (slab-family, D-P4b-3); here — UI only, for E-STR-01 — we rebuild the
 * concrete as a real stepped profile from the stair geometry. The box layout (incl. the D1 landing
 * slab) is the PURE `steppedStairSpec` (headless-tested); this component only renders its boxes.
 * Each step is a disjoint solid box; the D1 landing is a flat top slab modelling `landing_L`.
 */
function SteppedStair({ geometry, width }: { geometry: Record<string, number>; width: number }) {
  const { steps, landing } = steppedStairSpec(geometry, width);
  const boxes = landing ? [...steps, landing] : steps;
  return (
    <group>
      {boxes.map((box, i) => (
        <mesh key={i} position={box.position}>
          <boxGeometry args={box.size} />
          {concreteMaterial()}
          <Edges threshold={15} color={EDGE_COLOR} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Section-cut: a horizontal world clipping plane at the orbit centre (column mid-height) that
 * removes the upper half so the rebar cage is visible inside the concrete. Driven globally on
 * the renderer so it clips both concrete and bars.
 */
function SectionClip({ enabled }: { enabled: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
    gl.clippingPlanes = enabled ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)] : [];
    return () => {
      gl.clippingPlanes = [];
    };
  }, [gl, enabled]);
  return null;
}

function Scene() {
  const result = useStore((s) => s.result);
  const doc = useStore((s) => s.doc);
  const dragMode = useStore((s) => s.dragMode);
  const selectedGroupIds = useStore((s) => s.selectedGroupIds);
  const selectedBars = useStore((s) => s.selectedBars);
  const select = useStore((s) => s.select);
  const showSection = useStore((s) => s.showSection);
  const navMode = useStore((s) => s.navMode);

  const scene = useMemo(
    () => buildScene(result, doc, dragMode, selectedGroupIds, selectedBars),
    [result, doc, dragMode, selectedGroupIds, selectedBars],
  );

  // F7 + v1.0.6 N3 (U3): a 3D bar click routes through the ONE unified selection (single-select), so
  // the contextual inspector opens on the clicked bar and the 2D section highlight stays in sync.
  const onBarClick = (barIndex: number) =>
    select(selectedBars.length === 1 && selectedBars[0] === barIndex ? null : { kind: "bar", index: barIndex });

  const length = scene.concrete.length;
  // element-aware attitude (column upright / beam horizontal / slab flat) — §1.4, shared with the fiche.
  const rotation = memberGroupRotationFor(doc.element);
  // G8: E-STR-01 renders a stepped concrete profile (from its geometry) instead of the flat rect box.
  const stairGeometry =
    doc.element === "E-STR-01" && "geometry" in doc ? (doc.geometry as Record<string, number>) : null;

  // G9 (§9.2): the hand-pan tool maps LEFT-drag to pan; orbit stays on RIGHT-drag. Zoom always works.
  const mouseButtons =
    navMode === "pan"
      ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  return (
    <>
      <ProjectionRig />
      <ambientLight intensity={0.7} />
      <directionalLight position={[1, 2, 1.5]} intensity={1.2} />
      <SectionClip enabled={showSection} />
      {/* outer group rotates the member to its drawing attitude; inner group centers it on the target */}
      <group rotation={rotation}>
        <group scale={MM_TO_SCENE} position={[0, (-length / 2) * MM_TO_SCENE, 0]}>
          {stairGeometry ? (
            <SteppedStair geometry={stairGeometry} width={scene.concrete.b ?? 1200} />
          ) : (
            <ConcreteVolume concrete={scene.concrete} />
          )}
          {scene.bars.map((bar, i) => (
            <Rebar
              key={`${bar.groupId}-${i}`}
              bar={bar}
              mode={scene.mode}
              {...(bar.barIndex !== undefined ? { onPick: () => onBarClick(bar.barIndex!) } : {})}
            />
          ))}
          <CoupeHandles />
        </group>
      </group>
      <OrbitControls makeDefault enableDamping mouseButtons={mouseButtons} />
      <ViewController />
      <RollController />
      <ViewCubeGizmo />
    </>
  );
}

export function Viewport() {
  const debugPerf = useStore((s) => s.debugPerf);
  const lastSolveMs = useStore((s) => s.lastSolveMs);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas>
        <color attach="background" args={["#eef1f5"]} />
        <Scene />
      </Canvas>
      <ViewControls />
      {debugPerf && (
        <div className="perf-hud">solve: {lastSolveMs.toFixed(2)} ms</div>
      )}
    </div>
  );
}
