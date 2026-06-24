/**
 * App shell (spec §8): navbar on top; left sidebar (tabs + controls + live badges); center 3D
 * viewport; right alerts panel. The store wires them — a control mutation re-solves and every
 * panel + the viewport update in the same tick. No engine logic lives in this package (UI only
 * orchestrates + renders the engine's arrays).
 */
import { Navbar } from "./ui/Navbar";
import { Sidebar } from "./ui/Sidebar";
import { AlertsPanel } from "./ui/AlertsPanel";
import { Viewport } from "./viewport/Viewport";

export function App() {
  return (
    <div className="app">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="viewport-pane">
          <Viewport />
        </main>
        <AlertsPanel />
      </div>
    </div>
  );
}
