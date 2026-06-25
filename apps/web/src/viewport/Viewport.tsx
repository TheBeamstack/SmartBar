/**
 * R3F viewport (spec §2.1, §8): semi-transparent concrete volume + instanced rebar; failing
 * bars recolor absolute RED; OrbitControls; section-cut plane toggle; a perf HUD behind the
 * debug flag. All geometry comes from the engine via buildScene() — this component only orbits,
 * lights, and clips. Units are mm; the whole scene is scaled down for a comfortable camera.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useStore } from "../store/useStore";
import { buildScene, type ConcreteEnvelope } from "./rebarProps";
import { Rebar } from "./Rebar";

const MM_TO_SCENE = 0.01; // mm → scene units (a 3 m column ≈ 30 units)

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
  const showSection = useStore((s) => s.showSection);

  const scene = useMemo(
    () => buildScene(result, doc, dragMode, selectedGroupIds),
    [result, doc, dragMode, selectedGroupIds],
  );

  const length = scene.concrete.length;

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[1, 2, 1.5]} intensity={1.2} />
      <SectionClip enabled={showSection} />
      {/* center the member on the orbit target: shift down by length/2 */}
      <group scale={MM_TO_SCENE} position={[0, (-length / 2) * MM_TO_SCENE, 0]}>
        <ConcreteVolume concrete={scene.concrete} />
        {scene.bars.map((bar, i) => (
          <Rebar key={`${bar.groupId}-${i}`} bar={bar} mode={scene.mode} />
        ))}
      </group>
      <OrbitControls makeDefault enableDamping />
    </>
  );
}

export function Viewport() {
  const debugPerf = useStore((s) => s.debugPerf);
  const lastSolveMs = useStore((s) => s.lastSolveMs);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [40, 20, 50], fov: 45, near: 0.1, far: 2000 }}>
        <color attach="background" args={["#11151c"]} />
        <Scene />
      </Canvas>
      {debugPerf && (
        <div className="perf-hud">solve: {lastSolveMs.toFixed(2)} ms</div>
      )}
    </div>
  );
}
