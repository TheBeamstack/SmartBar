/**
 * `.rcfg` project I/O (spec §10, plan P5 step 5) — save/load + IndexedDB autosave & recovery.
 *
 * Forward-compat is NORMATIVE (§10, D-P0-2): parse → serialize → parse is lossless, and a v1.0
 * reader PRESERVES unknown top-level fields, unknown `ReinforcingElement.kind`s, AND unknown
 * `section_cut` fields. `rcfg_version` gates migrations. The pure serialise/parse functions are
 * headless; only `indexedDbStore()` touches the browser `indexedDB` (injected, so autosave is
 * unit-testable with `memoryStore()`).
 */
import type { RcfgDocument, SectionCut, SolveResult } from "@rebarconfig/core";
import { defaultCoupeFor } from "@rebarconfig/core";

/** The current writer version; older files are migrated up to it on load. */
export const CURRENT_RCFG_VERSION = "1.0";

/**
 * A `.rcfg` document plus the persisted user coupes (§9.5). `section_cuts` is additive; because
 * `RcfgDocument` already carries an index signature it survives a round-trip even on a reader that
 * doesn't type it — this just makes it first-class for the I/O + coupe manager.
 */
export interface RcfgProject extends RcfgDocument {
  section_cuts?: SectionCut[];
}

/** Serialise a project to the on-disk `.rcfg` JSON string (pretty-printed, stable key order). */
export function serializeRcfg(project: RcfgProject): string {
  return JSON.stringify(project, null, 2);
}

/**
 * Parse a `.rcfg` JSON string, migrating older versions up. Throws on a non-object / missing
 * `rcfg_version`. Unknown fields/kinds/cut-fields are preserved (JSON.parse keeps them; the typed
 * surface never strips them).
 */
export function parseRcfg(text: string): RcfgProject {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(".rcfg: expected a JSON object document");
  }
  const doc = raw as Record<string, unknown>;
  if (typeof doc["rcfg_version"] !== "string") {
    throw new Error(".rcfg: missing rcfg_version");
  }
  return migrateRcfg(doc as RcfgProject);
}

/** A single version step. v1.0 is current → the registry is a no-op today (extension point). */
type Migration = (doc: RcfgProject) => RcfgProject;
const MIGRATIONS: Record<string, Migration> = {
  // "0.9": (doc) => ({ ...doc, rcfg_version: "1.0", /* …field moves… */ }),
};

/**
 * Run any registered migrations from the file's version up to `CURRENT_RCFG_VERSION`. A FUTURE
 * (newer) version is loaded as-is — never dropped — preserving unknowns (forward-compat, §10).
 */
export function migrateRcfg(doc: RcfgProject): RcfgProject {
  let cur = doc;
  let guard = 0;
  while (cur.rcfg_version !== CURRENT_RCFG_VERSION && MIGRATIONS[cur.rcfg_version] && guard++ < 50) {
    cur = MIGRATIONS[cur.rcfg_version]!(cur);
  }
  return cur;
}

/** Read the persisted coupes, falling back to the seeded default coupe for a solved element. */
export function sectionCutsOrDefault(project: RcfgProject, result: SolveResult): SectionCut[] {
  if (project.section_cuts && project.section_cuts.length > 0) return project.section_cuts;
  return [defaultCoupeFor(result)];
}

// ---------------------------------------------------------------------------------------------
// Autosave: a tiny key/value store abstraction so recovery is testable without a real IndexedDB.
// ---------------------------------------------------------------------------------------------

export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** In-memory store — the autosave test double, and a safe fallback in non-browser contexts. */
export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    get: (k) => Promise.resolve(m.get(k)),
    set: (k, v) => {
      m.set(k, v);
      return Promise.resolve();
    },
    delete: (k) => {
      m.delete(k);
      return Promise.resolve();
    },
  };
}

export const AUTOSAVE_KEY = "rebarconfig:autosave";

/** Debounced-free autosave manager: persist the current project and recover it after a reload. */
export class AutosaveManager {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string = AUTOSAVE_KEY,
  ) {}

  async save(project: RcfgProject): Promise<void> {
    await this.store.set(this.key, serializeRcfg(project));
  }

  /** Restore the last autosaved project (or undefined if none / corrupt). */
  async recover(): Promise<RcfgProject | undefined> {
    const text = await this.store.get(this.key);
    if (text === undefined) return undefined;
    try {
      return parseRcfg(text);
    } catch {
      return undefined;
    }
  }

  async clear(): Promise<void> {
    await this.store.delete(this.key);
  }
}

// ---------------------------------------------------------------------------------------------
// Browser IndexedDB-backed store. Typed against minimal local shapes so the engine typecheck
// (lib: ES2022, no DOM) compiles without pulling the whole DOM lib.
// ---------------------------------------------------------------------------------------------

interface IdbRequestLike<T> {
  result: T;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  error: unknown;
}
interface IdbLike {
  open(name: string, version?: number): IdbRequestLike<unknown> & { onupgradeneeded: (() => void) | null };
}

const STORE_NAME = "projects";

function promisify<T>(req: IdbRequestLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * IndexedDB-backed `KeyValueStore` for the browser (autosave persistence). Returns `undefined`
 * (a no-op `memoryStore`) when `indexedDB` is unavailable (SSR / tests / older browsers).
 */
export function indexedDbStore(dbName = "rebarconfig"): KeyValueStore {
  const idb = (globalThis as { indexedDB?: IdbLike }).indexedDB;
  if (!idb) return memoryStore();

  const open = (): Promise<unknown> => {
    const req = idb.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result as { createObjectStore?: (n: string) => void; objectStoreNames: { contains(n: string): boolean } };
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore?.(STORE_NAME);
    };
    return promisify(req);
  };

  type Db = {
    transaction(store: string, mode: string): { objectStore(n: string): Record<string, (...a: unknown[]) => IdbRequestLike<unknown>> };
  };
  const tx = async (mode: "readonly" | "readwrite") => {
    const db = (await open()) as Db;
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  };

  return {
    async get(key) {
      const os = await tx("readonly");
      const v = await promisify(os["get"]!(key) as IdbRequestLike<unknown>);
      return typeof v === "string" ? v : undefined;
    },
    async set(key, value) {
      const os = await tx("readwrite");
      await promisify(os["put"]!(value, key) as IdbRequestLike<unknown>);
    },
    async delete(key) {
      const os = await tx("readwrite");
      await promisify(os["delete"]!(key) as IdbRequestLike<unknown>);
    },
  };
}
