/**
 * App shell (spec §8 + F4 [REF-UI-830]): navbar on top; left sidebar (tabs + controls + sticky
 * per-zone readout); center 3D viewport with a Coupes-only bottom dock; right column stacking
 * Verification + Project + BBS (collapsible, expandable over the 3D). The store wires them — a
 * control mutation re-solves and every panel + the viewport update in the same tick. No engine
 * logic lives in this package (UI only orchestrates + renders the engine's arrays).
 */
import { Navbar } from "./ui/Navbar";
import { Sidebar } from "./ui/Sidebar";
import { RightColumn } from "./ui/RightColumn";
import { BottomPanel } from "./ui/BottomPanel";
import { Viewport } from "./viewport/Viewport";
import { useAutosave } from "./ui/useAutosave";

export function App() {
  useAutosave();
  return (
    <div className="app">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="viewport-pane">
          <Viewport />
          <BottomPanel />
        </main>
        <RightColumn />
      </div>
    </div>
  );
}
