/**
 * App shell. v1.0.6 N4 / Track U1 ([REF-UI-830]) restructures it into a **drawing-board workspace**:
 * the live 3D `Viewport` stays central and always-on, flanked by two first-class, editable 2D docks —
 * a **section dock** (the pick canvas + the coupe, subsuming the old Coupes bottom dock) to its right
 * and an **elevation dock** below it. The left `Sidebar` becomes the inspector region the tabbed form
 * used to own (contextual inspector + compact setup strip + advanced-form fallback); the right
 * `RightColumn` (Verification / Project / BBS) is retained. Dock layout is session-only, never in
 * `.rcfg`. The store wires everything — a control mutation re-solves and every surface updates in the
 * same tick. No engine logic lives in this package (UI only orchestrates + renders the engine's arrays).
 */
import { Navbar } from "./ui/Navbar";
import { Sidebar } from "./ui/Sidebar";
import { RightColumn } from "./ui/RightColumn";
import { SectionDock } from "./ui/SectionDock";
import { ElevationDock } from "./ui/ElevationDock";
import { SolveErrorBanner } from "./ui/SolveErrorBanner";
import { Footer } from "./ui/Footer";
import { Viewport } from "./viewport/Viewport";
import { useAutosave } from "./ui/useAutosave";

export function App() {
  useAutosave();
  return (
    <div className="app">
      <Navbar />
      <SolveErrorBanner />
      <div className="app-body">
        <Sidebar />
        <main className="workspace">
          <div className="workspace-center">
            <div className="viewport-pane">
              <Viewport />
            </div>
            <SectionDock />
          </div>
          <ElevationDock />
        </main>
        <RightColumn />
      </div>
      <Footer />
    </div>
  );
}
