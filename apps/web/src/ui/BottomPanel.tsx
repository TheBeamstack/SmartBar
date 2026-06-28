/**
 * The bottom dock under the viewport. F4 ([REF-UI-830]) reduces it to the **Coupes** preview only
 * (spatially tied to the 3D); BBS + Project moved to the right column. Hidden when Coupes is off
 * so the 3D viewport keeps full height.
 */
import { useStore } from "../store/useStore";
import { CoupePanel } from "./CoupePanel";

export function BottomPanel() {
  const bottomPanel = useStore((s) => s.bottomPanel);
  if (bottomPanel !== "coupes") return null;
  return (
    <div className="bottom-panel">
      <CoupePanel />
    </div>
  );
}
