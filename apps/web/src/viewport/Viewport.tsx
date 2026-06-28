/**
 * R3F viewport (spec §2.1, §8): semi-transparent concrete volume + instanced rebar; failing
 * bars recolor absolute RED; OrbitControls; section-cut plane toggle; a perf HUD behind the
 * debug flag. All geometry comes from the engine via buildScene() — this component only orbits,
 * lights, and clips. Units are mm; the whole scene is scaled down for a comfortable camera.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useStore } from "../store/useStore";
import { buildScene, type ConcreteEnvelope } from "./rebarProps";
import { Rebar } from "./Rebar";
import { memberGroupRotationFor, rollUpVector, type Vec3 } from "./cameraState";
import { ProjectionRig, ViewController, ViewCubeGizmo, ViewControls } from "./ViewCube";
import { CoupeHandles } from "./CoupeOverlay";

const MM_TO_SCENE = 0.01; // mm → scene units (a 3 m column ≈ 30 units)

/**
 * F1 ([REF-SYS-811]) — applies the in-plane roll AFTER OrbitControls each frame (spec §1.3 approach
 * a): rolls `camera.up` about the view axis by `rollRad`. Orbit (X/Y) + zoom are untouched. When the
 * roll returns to 0 (a button to level, or a named-view snap) it restores world-up once. In-canvas.
 */
function RollController() {
  const rollRad = useStore((s) => s.rollRad);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3 } | null;
  const wasRolled = useRef(false);

  useFrame(() => {
    const target = controls?.target ?? new THREE.Vector3(0, 0, 0);
    if (!rollRad) {
      if (wasRolled.current) {
        camera.up.set(0, 1, 0); // re-level once when the roll clears
        camera.lookAt(target);
        wasRolled.current = false;
      }
      return;
    }
    const viewDir: Vec3 = [camera.position.x - target.x, camera.position.y - target.y, camera.position.z - target.z];
    const [ux, uy, uz] = rollUpVector(viewDir, rollRad);
    camera.up.set(ux, uy, uz);
    camera.lookAt(target);
    wasRolled.current = true;
  }, 1); // priority 1 → runs after drei OrbitControls' own update
  return null;
}

function ConcreteVolume({ concrete }: { concrete: ConcreteEnvelope }) {
  const mat = (
    <meshStandardMaterial
      color="#c8ccd2"
      transparent
      opacity={0.3}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );
  if (concrete.envelope === "CIRCULAR") {
    const r = (concrete.D ?? 600) / 2;
    return (
      <mesh>
        <cylinderGeometry args={[r, r, concrete.length, 48]} />
        {mat}
      </mesh>
    );
  }
  return (
    <mesh>
      <boxGeometry args={[concrete.b ?? 300, concrete.length, concrete.h ?? 600]} />
      {mat}
    </mesh>
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
  const setSelectedBars = useStore((s) => s.setSelectedBars);
  const showSection = useStore((s) => s.showSection);

  const scene = useMemo(
    () => buildScene(result, doc, dragMode, selectedGroupIds, selectedBars),
    [result, doc, dragMode, selectedGroupIds, selectedBars],
  );

  // F7: a 3D bar click toggles its selection (synced with the 2D section picker + highlight).
  const onBarClick = (barIndex: number) =>
    setSelectedBars(
      selectedBars.includes(barIndex)
        ? selectedBars.filter((x) => x !== barIndex)
        : [...selectedBars, barIndex],
    );

  const length = scene.concrete.length;
  // element-aware attitude (column upright / beam horizontal / slab flat) — §1.4, shared with the fiche.
  const rotation = memberGroupRotationFor(doc.element);

  return (
    <>
      <ProjectionRig />
      <ambientLight intensity={0.7} />
      <directionalLight position={[1, 2, 1.5]} intensity={1.2} />
      <SectionClip enabled={showSection} />
      {/* outer group rotates the member to its drawing attitude; inner group centers it on the target */}
      <group rotation={rotation}>
        <group scale={MM_TO_SCENE} position={[0, (-length / 2) * MM_TO_SCENE, 0]}>
          <ConcreteVolume concrete={scene.concrete} />
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
      <OrbitControls makeDefault enableDamping />
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
        <color attach="background" args={["#11151c"]} />
        <Scene />
      </Canvas>
      <ViewControls />
      {debugPerf && (
        <div className="perf-hud">solve: {lastSolveMs.toFixed(2)} ms</div>
      )}
    </div>
  );
}
