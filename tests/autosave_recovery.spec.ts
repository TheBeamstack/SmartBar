/**
 * Autosave + crash recovery (spec §10, plan P5). A persisted project is restored after a
 * "reload" (a fresh AutosaveManager over the same store), and clearing removes it.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  AutosaveManager,
  memoryStore,
  parseRcfg,
  type RcfgProject,
} from "@rebarconfig/exporters";
import { FIXTURES_DIR } from "./helpers";

const project = (): RcfgProject =>
  parseRcfg(fs.readFileSync(path.join(FIXTURES_DIR, "valid", "column.rcfg.json"), "utf8"));

describe("autosave_recovery (§10)", () => {
  it("crash → reopen restores the last autosaved state", async () => {
    const store = memoryStore(); // stands in for IndexedDB (survives the 'reload')
    const before = new AutosaveManager(store);
    const edited: RcfgProject = { ...project(), cover_marker: "edited", section_cuts: [
      { id: "A", origin: { x: 0, y: 1500, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
    ] };
    await before.save(edited);

    // simulate a crash + reopen: a brand-new manager over the SAME backing store
    const after = new AutosaveManager(store);
    const recovered = await after.recover();
    expect(recovered).toEqual(edited);
    expect(recovered!.section_cuts!.length).toBe(1);
  });

  it("returns undefined when there is nothing to recover", async () => {
    const mgr = new AutosaveManager(memoryStore());
    expect(await mgr.recover()).toBeUndefined();
  });

  it("clear() removes the autosave", async () => {
    const store = memoryStore();
    const mgr = new AutosaveManager(store);
    await mgr.save(project());
    await mgr.clear();
    expect(await mgr.recover()).toBeUndefined();
  });

  it("recovers gracefully (undefined) from a corrupt autosave", async () => {
    const store = memoryStore();
    await store.set("rebarconfig:autosave", "{ not valid json");
    const mgr = new AutosaveManager(store);
    expect(await mgr.recover()).toBeUndefined();
  });
});
