/**
 * Left sidebar (spec §8): live As,prov/As,req + computed-d badges, the three tabs (Schéma /
 * Géométrie / Projet-Code), the **Armatures complémentaires** (supplements) panel, and — under
 * the expert toggle — the resolved bar-group list (§5.6). Controls are conditional on the active
 * element (column ⇄ beam). Every control mutates the store, which re-solves synchronously.
 *
 * Common diameter set is a v1.0 convention (the ratified set is a §14 owner item).
 */
import { useState } from "react";
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";
import { NumberField } from "./NumberField";
import { SupplementsPanel } from "./SupplementsPanel";
import { asProvidedMm2, asReqMm2, cm2, effectiveDepthMm, meetsAsReq } from "./derived";
import { isColumnDoc, isGenericDoc, isBeamDoc } from "../engine/document";
import { GENERIC_SPECS, type GenericElementId } from "../engine/elementSpecs";

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

function ColumnSchemeControls() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setLongitudinal = useStore((s) => s.setLongitudinal);
  const setTie = useStore((s) => s.setTie);
  const s = t(lang);
  if (!isColumnDoc(doc)) return null;
  const L = doc.longitudinal;
  const T = doc.tie;

  // Under SYMMETRIC the engine ties opposite faces (nTop=nBottom, nLeft=nRight), so we expose only
  // the two DISTINCT counts; FREE exposes all four independently ([REF-UI-815], §6.1/§8).
  const symmetric = L.principle === "SYMMETRIC";

  return (
    <>
      <h3>{s.primaryBars}</h3>
      <DiameterSelect value={L.diameter} onChange={(v) => setLongitudinal({ diameter: v })} />
      {symmetric ? (
        <>
          <NumberField label={s.layout.verticalFaces} value={Math.max(L.nTop, L.nBottom)} min={0} max={8} onChange={(v) => setLongitudinal({ nTop: v, nBottom: v })} />
          <NumberField label={s.layout.horizontalFaces} value={Math.max(L.nLeft, L.nRight)} min={0} max={8} onChange={(v) => setLongitudinal({ nLeft: v, nRight: v })} />
        </>
      ) : (
        <>
          <NumberField label={s.countsTop} value={L.nTop} min={0} max={8} onChange={(v) => setLongitudinal({ nTop: v })} />
          <NumberField label={s.countsBottom} value={L.nBottom} min={0} max={8} onChange={(v) => setLongitudinal({ nBottom: v })} />
          <NumberField label={s.countsLeft} value={L.nLeft} min={0} max={8} onChange={(v) => setLongitudinal({ nLeft: v })} />
          <NumberField label={s.countsRight} value={L.nRight} min={0} max={8} onChange={(v) => setLongitudinal({ nRight: v })} />
        </>
      )}
      <NumberField label={s.asRequired + " (mm²)"} value={L.asReq} min={0} max={20000} step={50} onChange={(v) => setLongitudinal({ asReq: v })} />

      <h3>{s.ties}</h3>
      <DiameterSelect value={T.diameter} onChange={(v) => setTie({ diameter: v })} />
      <NumberField label={s.spacing} value={T.spacing} min={50} max={400} step={5} onChange={(v) => setTie({ spacing: v })} />
      <NumberField label={s.legs} value={T.nLegs} min={2} max={6} onChange={(v) => setTie({ nLegs: v })} />
      <NumberField label="Asw,req (mm²/m)" value={T.aswReqPerM} min={0} max={2000} step={10} onChange={(v) => setTie({ aswReqPerM: v })} />
    </>
  );
}

function BeamSchemeControls() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setSpan = useStore((s) => s.setSpan);
  const setChapeau = useStore((s) => s.setChapeau);
  const setStirrup = useStore((s) => s.setStirrup);
  const setTopBars = useStore((s) => s.setTopBars);
  const s = t(lang);
  if (!isBeamDoc(doc)) return null;
  const { span, chapeau, stirrup, topBars } = doc;

  return (
    <>
      <h3>{s.beam.spanSteel}</h3>
      <DiameterSelect value={span.diameter} onChange={(v) => setSpan({ diameter: v })} />
      <NumberField label={s.beam.bottomBars} value={span.nBottom} min={2} max={8} onChange={(v) => setSpan({ nBottom: v })} />
      <NumberField label={s.asRequired + " (mm²)"} value={span.asReq} min={0} max={20000} step={50} onChange={(v) => setSpan({ asReq: v })} />
      <NumberField label={s.beam.continued} value={span.continuedToSupport} min={0} max={1} step={0.05} onChange={(v) => setSpan({ continuedToSupport: v })} />

      <h3>{s.beam.montageTitle}</h3>
      <label className="field field-check">
        <input type="checkbox" checked={topBars.enabled} onChange={(e) => setTopBars({ enabled: e.target.checked })} />
        <span className="field-label">{s.beam.montageEnable}</span>
      </label>
      {topBars.enabled && (
        <>
          <DiameterSelect value={topBars.diameter} onChange={(v) => setTopBars({ diameter: v })} />
          <NumberField label={s.beam.montageBars} value={topBars.nTop} min={2} max={8} onChange={(v) => setTopBars({ nTop: v })} />
        </>
      )}

      {chapeau.enabled && (
        <>
          <h3>{s.beam.chapeaux}</h3>
          <DiameterSelect value={chapeau.diameter} onChange={(v) => setChapeau({ diameter: v })} />
          <NumberField label={s.beam.topBars} value={chapeau.nTop} min={2} max={8} onChange={(v) => setChapeau({ nTop: v })} />
          <NumberField label={s.asRequired + " (mm²)"} value={chapeau.asReq} min={0} max={20000} step={50} onChange={(v) => setChapeau({ asReq: v })} />
          <NumberField label={s.beam.supportZone} value={chapeau.supportZone} min={0} max={3000} step={50} onChange={(v) => setChapeau({ supportZone: v })} />
        </>
      )}

      <h3>{s.beam.stirrups}</h3>
      <DiameterSelect value={stirrup.diameter} onChange={(v) => setStirrup({ diameter: v })} />
      <NumberField label={s.spacing} value={stirrup.spacing} min={50} max={400} step={5} onChange={(v) => setStirrup({ spacing: v })} />
      <NumberField label={s.legs} value={stirrup.nLegs} min={2} max={6} onChange={(v) => setStirrup({ nLegs: v })} />
      <NumberField label="Asw,req (mm²/m)" value={stirrup.aswReqPerM} min={0} max={2000} step={10} onChange={(v) => setStirrup({ aswReqPerM: v })} />
    </>
  );
}

/** Full per-zone reinforcement controls for the six non-rect elements (data-driven from the doc). */
function GenericSchemeControls() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setZone = useStore((s) => s.setZone);
  const setGenericFlag = useStore((s) => s.setGenericFlag);
  const s = t(lang);
  if (!isGenericDoc(doc)) return null;

  return (
    <>
      {doc.zones.map((z) => (
        <div key={z.groupId} className="zone-block">
          <h3>{lang === "fr" ? z.label_fr : z.label_en}</h3>
          <DiameterSelect value={z.diameter} onChange={(v) => setZone(z.groupId, { diameter: v })} />
          {z.control === "count" ? (
            <NumberField label={s.generic.count} value={z.count ?? 0} min={0} max={40} onChange={(v) => setZone(z.groupId, { count: v })} />
          ) : (
            <NumberField label={s.spacing} value={z.spacing ?? 150} min={50} max={400} step={5} onChange={(v) => setZone(z.groupId, { spacing: v })} />
          )}
          {z.kind === "transverse" ? (
            <NumberField label="Asw,req (mm²/m)" value={z.asReqPerM ?? 0} min={0} max={2000} step={10} onChange={(v) => setZone(z.groupId, { asReqPerM: v })} />
          ) : z.control === "count" ? (
            <NumberField label={s.asRequired + " (mm²)"} value={z.asReq ?? 0} min={0} max={40000} step={50} onChange={(v) => setZone(z.groupId, { asReq: v })} />
          ) : (
            <NumberField label={s.generic.asReqPerM} value={z.asReqPerM ?? 0} min={0} max={4000} step={10} onChange={(v) => setZone(z.groupId, { asReqPerM: v })} />
          )}
        </div>
      ))}

      {doc.element === "E-SLB-02" && (
        <div className="zone-block">
          <h3>{s.generic.cornerTorsion}</h3>
          <label className="field field-check">
            <input type="checkbox" checked={doc.restrainedCorner ?? false} onChange={(e) => setGenericFlag({ restrainedCorner: e.target.checked })} />
            <span className="field-label">{s.generic.restrainedCorner}</span>
          </label>
          <NumberField label={s.generic.cornerTorsion} value={doc.cornerTorsionProvided ?? 0} min={0} max={2000} step={10} onChange={(v) => setGenericFlag({ cornerTorsionProvided: v })} />
        </div>
      )}
      {doc.element === "E-STR-01" && (
        <label className="field field-check">
          <input type="checkbox" checked={doc.mainBarWrapsCorner ?? false} onChange={(e) => setGenericFlag({ mainBarWrapsCorner: e.target.checked })} />
          <span className="field-label">{s.generic.wrapCorner}</span>
        </label>
      )}
    </>
  );
}

function SchemeControls() {
  const doc = useStore((s) => s.doc);
  if (isColumnDoc(doc)) return <ColumnSchemeControls />;
  if (isBeamDoc(doc)) return <BeamSchemeControls />;
  return <GenericSchemeControls />;
}

function SchemeTab() {
  const doc = useStore((s) => s.doc);
  return (
    <div className="tab-body">
      <SchemeControls />
      {!isGenericDoc(doc) && <SupplementsPanel />}
    </div>
  );
}

/** Geometry controls for the six non-rect elements — fields declared in the element spec. */
function GenericGeometryControls() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setGenericGeometry = useStore((s) => s.setGenericGeometry);
  const setCover = useStore((s) => s.setCover);
  const s = t(lang);
  if (!isGenericDoc(doc)) return null;
  const spec = GENERIC_SPECS[doc.element as GenericElementId];

  return (
    <div className="tab-body">
      {spec.geometry.map((f) => (
        <NumberField
          key={f.key}
          label={lang === "fr" ? f.label_fr : f.label_en}
          value={doc.geometry[f.key] ?? f.default}
          min={f.min}
          max={f.max}
          step={f.step}
          onChange={(v) => setGenericGeometry(f.key, v)}
        />
      ))}
      <NumberField label={s.cover} value={doc.cover} min={15} max={75} onChange={setCover} />
    </div>
  );
}

function GeometryTab() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setGeometry = useStore((s) => s.setGeometry);
  const setBeamGeometry = useStore((s) => s.setBeamGeometry);
  const setCover = useStore((s) => s.setCover);
  const setLongitudinal = useStore((s) => s.setLongitudinal);
  const s = t(lang);

  if (isGenericDoc(doc)) return <GenericGeometryControls />;

  return (
    <div className="tab-body">
      <NumberField label={s.section.b} value={doc.geometry.b} min={150} max={1200} step={10} onChange={(v) => (isColumnDoc(doc) ? setGeometry({ b: v }) : setBeamGeometry({ b: v }))} />
      <NumberField label={s.section.h} value={doc.geometry.h} min={150} max={1500} step={10} onChange={(v) => (isColumnDoc(doc) ? setGeometry({ h: v }) : setBeamGeometry({ h: v }))} />
      {isColumnDoc(doc) ? (
        <NumberField label={s.section.height} value={doc.geometry.H} min={500} max={8000} step={50} onChange={(v) => setGeometry({ H: v })} />
      ) : (
        <NumberField label={s.beam.span} value={doc.geometry.L} min={1000} max={12000} step={100} onChange={(v) => setBeamGeometry({ L: v })} />
      )}
      <NumberField label={s.cover} value={doc.cover} min={15} max={60} onChange={setCover} />
      {isColumnDoc(doc) && (
        <label className="field">
          <span className="field-label">{s.layout.principle}</span>
          <select
            value={doc.longitudinal.principle}
            aria-label={s.layout.principle}
            onChange={(e) => setLongitudinal({ principle: e.target.value as "SYMMETRIC" | "FREE" })}
          >
            <option value="SYMMETRIC">{s.layout.symmetric}</option>
            <option value="FREE">{s.layout.free}</option>
          </select>
        </label>
      )}
    </div>
  );
}

const EXPOSURES = ["INTERIOR", "EXTERIOR", "XS1", "CAST_AGAINST_EARTH"];

/** Seismic regime picker (§7.10) — overlay applies to the column + beam (plastic-hinge members). */
function SeismicControls() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setSeismic = useStore((s) => s.setSeismic);
  const s = t(lang);
  if (isGenericDoc(doc)) return null; // seismic overlay = column/beam only in v1.0
  const cur = doc.seismic;
  const value = cur ? cur.ductility : "NONE";

  return (
    <>
      <h3>{s.seismic.title}</h3>
      <label className="field">
        <span className="field-label">{s.seismic.regime}</span>
        <select
          value={value}
          aria-label={s.seismic.regime}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "NONE") setSeismic(null);
            else setSeismic({ code: "RPS-2011", zone: cur?.zone ?? 2, ductility: v as "ND1" | "ND2" | "ND3" });
          }}
        >
          <option value="NONE">{s.seismic.none}</option>
          <option value="ND1">RPS-2011 — ND1</option>
          <option value="ND2">RPS-2011 — ND2</option>
          <option value="ND3">RPS-2011 — ND3</option>
        </select>
      </label>
      {cur && (
        <NumberField
          label={s.seismic.zone}
          value={cur.zone}
          min={1}
          max={4}
          onChange={(v) => setSeismic({ ...cur, zone: v })}
        />
      )}
    </>
  );
}

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
      <SeismicControls />
    </div>
  );
}

function ExpertGroups() {
  const lang = useStore((s) => s.lang);
  const groups = useStore((s) => s.result.groups);
  const s = t(lang);
  return (
    <div className="expert-groups">
      <h3>{s.groups}</h3>
      <ul className="group-list">
        {groups.map((g) => (
          <li key={g.groupId} className="group-row">
            <span className="group-id">{g.groupId}</span>
            <span className="group-meta">
              {g.role} · Ø{g.diameter} · ×{g.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar() {
  const lang = useStore((s) => s.lang);
  const expert = useStore((s) => s.expert);
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
      {expert && <ExpertGroups />}
    </aside>
  );
}
