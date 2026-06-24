/**
 * Left sidebar (spec §8): live As,prov/As,req + computed-d badges on top, then the three tabs
 * (Schéma / Géométrie / Projet-Code). Every control mutates the store, which re-solves
 * synchronously — the badges + viewport update live. Common diameter set is a P2 convention
 * (the ratified set is a §14 owner item).
 */
import { useState } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { NumberField } from "./NumberField";
import { asProvidedMm2, asReqMm2, cm2, effectiveDepthMm, meetsAsReq } from "./derived";

type Tab = "scheme" | "geometry" | "project";

const DIAMETERS = [6, 8, 10, 12, 14, 16, 20, 25, 32];

function Badges() {
  const lang = useStore((s) => s.lang);
  const result = useStore((s) => s.result);
  const doc = useStore((s) => s.doc);
  const s = t(lang);
  const asProv = asProvidedMm2(result, doc);
  const asReq = asReqMm2(doc);
  const d = effectiveDepthMm(result);
  const ok = meetsAsReq(result, doc);

  return (
    <div className="badges">
      <div className={`badge ${ok ? "badge-ok" : "badge-bad"}`}>
        <span className="badge-key">{s.asProvided}</span>
        <span className="badge-val">{cm2(asProv)} cm²</span>
      </div>
      <div className="badge">
        <span className="badge-key">{s.asRequired}</span>
        <span className="badge-val">{cm2(asReq)} cm²</span>
      </div>
      <div className="badge">
        <span className="badge-key">{s.effectiveDepth}</span>
        <span className="badge-val">{d === null ? "—" : `${d.toFixed(0)} mm`}</span>
      </div>
    </div>
  );
}

function DiameterSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const lang = useStore((s) => s.lang);
  return (
    <label className="field">
      <span className="field-label">{t(lang).diameter}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {DIAMETERS.map((d) => (
          <option key={d} value={d}>
            Ø{d}
          </option>
        ))}
      </select>
    </label>
  );
}

function SchemeTab() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setLongitudinal = useStore((s) => s.setLongitudinal);
  const setTie = useStore((s) => s.setTie);
  const s = t(lang);
  const L = doc.longitudinal;
  const T = doc.tie;

  return (
    <div className="tab-body">
      <h3>{s.primaryBars}</h3>
      <DiameterSelect value={L.diameter} onChange={(v) => setLongitudinal({ diameter: v })} />
      <NumberField label={s.countsTop} value={L.nTop} min={0} max={8} onChange={(v) => setLongitudinal({ nTop: v })} />
      <NumberField label={s.countsBottom} value={L.nBottom} min={0} max={8} onChange={(v) => setLongitudinal({ nBottom: v })} />
      <NumberField label={s.countsLeft} value={L.nLeft} min={0} max={8} onChange={(v) => setLongitudinal({ nLeft: v })} />
      <NumberField label={s.countsRight} value={L.nRight} min={0} max={8} onChange={(v) => setLongitudinal({ nRight: v })} />
      <NumberField label={s.asRequired + " (mm²)"} value={L.asReq} min={0} max={20000} step={50} onChange={(v) => setLongitudinal({ asReq: v })} />

      <h3>{s.ties}</h3>
      <DiameterSelect value={T.diameter} onChange={(v) => setTie({ diameter: v })} />
      <NumberField label={s.spacing} value={T.spacing} min={50} max={400} step={5} onChange={(v) => setTie({ spacing: v })} />
      <NumberField label={s.legs} value={T.nLegs} min={2} max={6} onChange={(v) => setTie({ nLegs: v })} />
      <NumberField label="Asw,req (mm²/m)" value={T.aswReqPerM} min={0} max={2000} step={10} onChange={(v) => setTie({ aswReqPerM: v })} />
    </div>
  );
}

function GeometryTab() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setGeometry = useStore((s) => s.setGeometry);
  const setCover = useStore((s) => s.setCover);
  const s = t(lang);

  return (
    <div className="tab-body">
      <NumberField label={s.section.b} value={doc.geometry.b} min={150} max={1200} step={10} onChange={(v) => setGeometry({ b: v })} />
      <NumberField label={s.section.h} value={doc.geometry.h} min={150} max={1500} step={10} onChange={(v) => setGeometry({ h: v })} />
      <NumberField label={s.section.height} value={doc.geometry.H} min={500} max={8000} step={50} onChange={(v) => setGeometry({ H: v })} />
      <NumberField label={s.cover} value={doc.cover} min={15} max={60} onChange={setCover} />
    </div>
  );
}

const EXPOSURES = ["INTERIOR", "EXTERIOR", "MARINE", "CAST_AGAINST_EARTH"];

function ProjectTab() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setMaterial = useStore((s) => s.setMaterial);
  const setExposure = useStore((s) => s.setExposure);
  const s = t(lang);

  return (
    <div className="tab-body">
      <h3>{s.material.title}</h3>
      <NumberField label={s.material.concrete} value={doc.material.f_c28} min={20} max={60} step={1} onChange={(v) => setMaterial({ f_c28: v })} />
      <NumberField label={s.material.steel} value={doc.material.f_e} min={400} max={600} step={50} onChange={(v) => setMaterial({ f_e: v })} />
      <label className="field">
        <span className="field-label">{s.exposure}</span>
        <select value={doc.exposure} onChange={(e) => setExposure(e.target.value)}>
          {EXPOSURES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function Sidebar() {
  const lang = useStore((s) => s.lang);
  const [tab, setTab] = useState<Tab>("scheme");
  const s = t(lang);

  return (
    <aside className="sidebar">
      <Badges />
      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "scheme"} className={tab === "scheme" ? "active" : ""} onClick={() => setTab("scheme")}>
          {s.tabScheme}
        </button>
        <button role="tab" aria-selected={tab === "geometry"} className={tab === "geometry" ? "active" : ""} onClick={() => setTab("geometry")}>
          {s.tabGeometry}
        </button>
        <button role="tab" aria-selected={tab === "project"} className={tab === "project" ? "active" : ""} onClick={() => setTab("project")}>
          {s.tabProject}
        </button>
      </nav>
      {tab === "scheme" && <SchemeTab />}
      {tab === "geometry" && <GeometryTab />}
      {tab === "project" && <ProjectTab />}
    </aside>
  );
}
