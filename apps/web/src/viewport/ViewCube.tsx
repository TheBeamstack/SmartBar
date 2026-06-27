/**
 * ViewCube widget (spec v1.0.1 Feature A). The GPU half of the camera control: a clickable cube
 * gizmo in the viewport corner (snap to named views) that reflects the live camera, a projection
 * toggle (perspective ⇄ orthographic), an element-aware Home, and — for accessibility (§1.6) — a
 * keyboard/`<select>` list of the 26 named views. All of this drives the SAME camera state; the
 * pure logic lives in `cameraState.ts` (headless-tested). This file needs a browser/GPU to verify.
 */
import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import {
  GizmoHelper,
  GizmoViewcube,
  PerspectiveCamera,
  OrthographicCamera,
} from "@react-three/drei";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { NAMED_VIEWS, viewById } from "./cameraState";

const CAM_POS: [number, number, number] = [40, 20, 50];

/** The single default camera, swapped by the projection toggle (§1.5). In-canvas. */
export function ProjectionRig() {
  const projection = useStore((s) => s.projection);
  return projection === "orthographic" ? (
    <OrthographicCamera makeDefault position={CAM_POS} zoom={8} near={0.1} far={2000} />
  ) : (
    <PerspectiveCamera makeDefault position={CAM_POS} fov={45} near={0.1} far={2000} />
  );
}

/** Applies a named-view snap request to the default camera, preserving zoom/target (§1.3). In-canvas. */
export function ViewController() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target?: THREE.Vector3; update?: () => void } | null;
  const viewRequest = useStore((s) => s.viewRequest);

  useEffect(() => {
    if (!viewRequest) return;
    const view = viewById(viewRequest.id);
    if (!view) return;
    const target = controls?.target ?? new THREE.Vector3(0, 0, 0);
    const dist = camera.position.distanceTo(target) || 60;
    const [dx, dy, dz] = view.dir;
    camera.position.set(target.x + dx * dist, target.y + dy * dist, target.z + dz * dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    controls?.update?.();
    // nonce in the dep array → re-runs on every request, even to the same view id.
  }, [viewRequest, camera, controls]);

  return null;
}

/** The corner cube gizmo: click a face/edge/corner to snap; reflects the live camera. In-canvas. */
export function ViewCubeGizmo() {
  const lang = useStore((s) => s.lang);
  // drei face order: [Right, Left, Top, Bottom, Front, Back].
  const faces =
    lang === "fr"
      ? ["Droite", "Gauche", "Haut", "Bas", "Avant", "Arrière"]
      : ["Right", "Left", "Top", "Bottom", "Front", "Back"];
  return (
    <GizmoHelper alignment="top-right" margin={[72, 72]}>
      <GizmoViewcube faces={faces} />
    </GizmoHelper>
  );
}

/**
 * HTML overlay (outside the Canvas) — the a11y/keyboard parity path (§1.6): a named-view select,
 * a Home button, and the projection toggle. Same camera state the cube drives.
 */
export function ViewControls() {
  const lang = useStore((s) => s.lang);
  const projection = useStore((s) => s.projection);
  const requestView = useStore((s) => s.requestView);
  const homeView = useStore((s) => s.homeView);
  const toggleProjection = useStore((s) => s.toggleProjection);
  const s = t(lang);

  return (
    <div className="view-controls" role="group" aria-label={s.view.title}>
      <label className="view-field">
        <span className="sr-only">{s.view.namedView}</span>
        <select
          aria-label={s.view.namedView}
          value=""
          onChange={(e) => {
            if (e.target.value) requestView(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">{s.view.namedView}…</option>
          {NAMED_VIEWS.map((v) => (
            <option key={v.id} value={v.id}>
              {lang === "fr" ? v.label_fr : v.label_en}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={homeView} title={s.view.home} aria-label={s.view.home}>
        ⌂
      </button>
      <button
        type="button"
        onClick={toggleProjection}
        aria-pressed={projection === "orthographic"}
        title={`${s.view.projection}: ${projection === "orthographic" ? s.view.orthographic : s.view.perspective}`}
      >
        {projection === "orthographic" ? s.view.orthographic : s.view.perspective}
      </button>
    </div>
  );
}
