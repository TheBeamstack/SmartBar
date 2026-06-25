/**
 * The collapsible bottom dock under the viewport — shows either the coupe manager or the BBS table
 * (toggled from the navbar). Hidden when no panel is selected so the 3D viewport keeps full height.
 */
import { useStore } from "../store/useStore";
import { CoupePanel } from "./CoupePanel";
import { BbsPanel } from "./BbsPanel";

export function BottomPanel() {
  const bottomPanel = useStore((s) => s.bottomPanel);
  if (bottomPanel === null) return null;
  return (
    <div className="bottom-panel">
      {bottomPanel === "coupes" ? <CoupePanel /> : <BbsPanel />}
    </div>
  );
}
