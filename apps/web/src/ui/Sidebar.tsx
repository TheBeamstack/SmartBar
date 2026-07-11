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
import { NumberInput } from "./NumberInput";
import { Stepper } from "./Stepper";
import { SupplementsPanel } from "./SupplementsPanel";
import { CrossTieEditor } from "./CrossTieEditor";
import { RegionEditor } from "./RegionEditor";
import { FaconnageEditor } from "./FaconnageEditor";
import { AddressableBars } from "./AddressableBars";
import { Inspector } from "./Inspector";
import { ElementSetupStrip } from "./ElementSetupStrip";
import { cm2, perZoneReadout } from "./derived";
import { isColumnDoc, isGenericDoc, isBeamDoc, type Splice, type CodePackId } from "../engine/document";
import { GENERIC_SPECS, type GenericElementId } from "../engine/elementSpecs";

type Tab = "scheme" | "geometry" | "project";

const DIAMETERS = [6, 8, 10, 12, 14, 16, 20, 25, 32];

const STATUS_SYMBOL = { PASS: "🟢", WARN: "🟠", FAIL: "🔴" } as const;

/**
 * F3 ([REF-UI-820]) — a sticky per-zone verification readout pinned to the top of the controls
 * column so the config-dependent results never scroll away. One row per flexural zone (As,prov vs
 * As,req, coloured, with `d`) plus an overall status chip. Replaces the old single-aggregate badges.
 */
function ZoneReadout() {
  const lang = useStore((s) => s.lang);
  const result = useStore((s) => s.result);
  const doc = useStore((s) => s.doc);
  const s = t(lang);
  const rows = perZoneReadout(result, doc, lang);
  const statusLabel =
    result.status === "FAIL" ? s.status.fail : result.status === "WARN" ? s.status.warn : s.status.pass;

  return (
    <div className="readout badges" role="status" aria-live="polite">
      <div className="readout-head">
        <span className="readout-title">{s.readout.title}</span>
        <span className={`readout-overall status-${result.status.toLowerCase()}`}>
          {STATUS_SYMBOL[result.status]} {statusLabel}
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.zone} className={`readout-row ${r.ok ? "badge-ok" : "badge-bad"}`}>
          <span className="readout-label">{r.label}</span>
          <span className="readout-areas">
            <span className="badge-val">{cm2(r.asProvMm2)}</span>
            <span className="readout-cmp">{r.ok ? "≥" : "<"}</span>
            <span className="readout-req">
              {cm2(r.asReqMm2)} cm²{r.perMetre ? "/m" : ""}
            </span>
          </span>
          <span className="readout-d">{r.d === null ? "—" : `d ${r.d.toFixed(0)}`}</span>
        </div>
      ))}
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

/**
 * G4 ([REF-UI-770]): lap-splice / coupler editor for the active primary longitudinal group (column
 * verticals or beam span bars). Auto-splice toggle + a station/kind list (picker AND numeric — a11y).
 */
function SpliceEditor() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setLongitudinal = useStore((s) => s.setLongitudinal);
  const setSpan = useStore((s) => s.setSpan);
  const s = t(lang);
  const isCol = isColumnDoc(doc);
  if (!isCol && !isBeamDoc(doc)) return null;
  const group = isCol ? doc.longitudinal : doc.span;
  const memberLen = isCol ? doc.geometry.H : doc.geometry.L;
  const splices = group.splices ?? [];
  const patch = (p: { splices?: Splice[]; autoSplice?: boolean }): void => {
    if (isCol) setLongitudinal(p);
    else setSpan(p);
  };
  const add = (kind: Splice["kind"]) => patch({ splices: [...splices, { at: Math.round(memberLen / 2), kind }] });
  return (
    <>
      <h3>{s.splice.title}</h3>
      <label className="field field-check">
        <input type="checkbox" checked={group.autoSplice ?? false} onChange={(e) => patch({ autoSplice: e.target.checked })} />
        <span className="field-label">{s.splice.auto}</span>
      </label>
      {splices.map((sp, i) => (
        <div className="field-row" key={i}>
          <select aria-label={s.splice.kind} value={sp.kind} onChange={(e) => patch({ splices: splices.map((x, j) => (j === i ? { ...x, kind: e.target.value as Splice["kind"] } : x)) })}>
            <option value="lap">{s.splice.lap}</option>
            <option value="coupler">{s.splice.coupler}</option>
          </select>
          <NumberInput label={s.splice.station} value={sp.at} min={0} max={memberLen} step={50} onChange={(v) => patch({ splices: splices.map((x, j) => (j === i ? { ...x, at: v } : x)) })} />
          <button type="button" className="btn-mini" onClick={() => patch({ splices: splices.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <div className="field-row">
        <button type="button" className="btn-mini" onClick={() => add("lap")}>{s.splice.addLap}</button>
        <button type="button" className="btn-mini" onClick={() => add("coupler")}>{s.splice.addCoupler}</button>
      </div>
    </>
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
      {/* v1.0.6 N3 (U3): the ONE unified section canvas now lives in the always-visible sidebar region
          (see `Sidebar`), not inside the scheme form — so it (and the inspector) stay reachable when
          the advanced form is collapsed. */}
      <h3>{s.primaryBars}</h3>
      <DiameterSelect value={L.diameter} onChange={(v) => setLongitudinal({ diameter: v })} />
      {symmetric ? (
        <>
          <Stepper label={s.layout.verticalFaces} value={Math.max(L.nTop, L.nBottom)} min={0} max={8} onChange={(v) => setLongitudinal({ nTop: v, nBottom: v })} />
          <Stepper label={s.layout.horizontalFaces} value={Math.max(L.nLeft, L.nRight)} min={0} max={8} onChange={(v) => setLongitudinal({ nLeft: v, nRight: v })} />
        </>
      ) : (
        <>
          <Stepper label={s.countsTop} value={L.nTop} min={0} max={8} onChange={(v) => setLongitudinal({ nTop: v })} />
          <Stepper label={s.countsBottom} value={L.nBottom} min={0} max={8} onChange={(v) => setLongitudinal({ nBottom: v })} />
          <Stepper label={s.countsLeft} value={L.nLeft} min={0} max={8} onChange={(v) => setLongitudinal({ nLeft: v })} />
          <Stepper label={s.countsRight} value={L.nRight} min={0} max={8} onChange={(v) => setLongitudinal({ nRight: v })} />
        </>
      )}
      <NumberInput label={s.asRequired + " (mm²)"} value={L.asReq} min={0} max={20000} step={50} onChange={(v) => setLongitudinal({ asReq: v })} />
      <FaconnageEditor
        key={`${doc.element}-${L.groupId}`}
        shapeId={L.shapeId}
        diameter={L.diameter}
        faconnage={L.faconnage}
        memberLength={doc.geometry.H}
        onChange={(patch) => setLongitudinal(patch)}
      />
      <AddressableBars />
      <SpliceEditor />

      <h3>{s.ties}</h3>
      <DiameterSelect value={T.diameter} onChange={(v) => setTie({ diameter: v })} />
      <NumberInput label={s.spacing} value={T.spacing} min={50} max={400} step={5} onChange={(v) => setTie({ spacing: v })} />
      <NumberInput label="Asw,req (mm²/m)" value={T.aswReqPerM} min={0} max={2000} step={10} onChange={(v) => setTie({ aswReqPerM: v })} />

      <CrossTieEditor />
      <RegionEditor />
    </>
  );
}

/** G3 ([REF-UI-260]): one beam support (V1 left / V2 right) — its chapeau + anchorage + width. */
function SupportControls({ side }: { side: "left" | "right" }) {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setSupport = useStore((s) => s.setSupport);
  const s = t(lang);
  if (!isBeamDoc(doc)) return null;
  const sup = doc.supports[side];
  const title = side === "left" ? s.beam.supportV1 : s.beam.supportV2;
  return (
    <>
      <h3>{title}</h3>
      <label className="field field-check">
        <input type="checkbox" checked={sup.chapeau.enabled} onChange={(e) => setSupport(side, { chapeau: { enabled: e.target.checked } })} />
        <span className="field-label">{s.beam.chapeaux}</span>
      </label>
      {sup.chapeau.enabled && (
        <>
          <DiameterSelect value={sup.chapeau.diameter} onChange={(v) => setSupport(side, { chapeau: { diameter: v } })} />
          <Stepper label={s.beam.topBars} value={sup.chapeau.nTop} min={2} max={8} onChange={(v) => setSupport(side, { chapeau: { nTop: v } })} />
          <NumberInput label={s.asRequired + " (mm²)"} value={sup.chapeau.asReq} min={0} max={20000} step={50} onChange={(v) => setSupport(side, { chapeau: { asReq: v } })} />
          <NumberInput label={s.beam.supportZone} value={sup.chapeau.length} min={0} max={3000} step={50} onChange={(v) => setSupport(side, { chapeau: { length: v } })} />
        </>
      )}
      <NumberInput label={s.beam.anchorage} value={sup.anchorage} min={0} max={2000} step={10} onChange={(v) => setSupport(side, { anchorage: v })} />
      <NumberInput label={s.beam.supportWidth} value={sup.width} min={100} max={1000} step={10} onChange={(v) => setSupport(side, { width: v })} />
    </>
  );
}

/** G3 ([REF-UI-260]): bent-up bottom bars (relevés) near a support — count/Ø/side, add & remove. */
function ReleveEditor() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setReleves = useStore((s) => s.setReleves);
  const setReleveBend = useStore((s) => s.setReleveBend);
  const s = t(lang);
  if (!isBeamDoc(doc)) return null;
  const releves = doc.releves ?? [];
  const L = doc.geometry.L;
  const add = () =>
    setReleves([...releves, { id: `R${releves.length + 1}`, support: "left", count: 2, diameter: 12 }]);
  return (
    <>
      <h3>{s.beam.releves}</h3>
      {releves.map((r, i) => (
        <div className="field-row field-row-wrap" key={r.id}>
          <select aria-label={s.beam.releveSupport} value={r.support} onChange={(e) => setReleves(releves.map((x, j) => (j === i ? { ...x, support: e.target.value as "left" | "right" } : x)))}>
            <option value="left">V1</option>
            <option value="right">V2</option>
          </select>
          <Stepper label={s.beam.releveCount} value={r.count} min={1} max={8} onChange={(v) => setReleves(releves.map((x, j) => (j === i ? { ...x, count: v } : x)))} />
          <DiameterSelect value={r.diameter} onChange={(v) => setReleves(releves.map((x, j) => (j === i ? { ...x, diameter: v } : x)))} />
          {/* v1.0.6 N6: the bend-up STATION — the numeric twin of grabbing the relevé's bend point on
              the elevation. Absent → the legacy 0.25·L default (shown as the current value). */}
          <NumberInput label={s.elevation.bendStation} value={r.bendStation ?? Math.round(L * 0.25)} min={0} max={L} step={50} unit="mm" onChange={(v) => setReleveBend(r.id, v)} />
          <button type="button" className="btn-mini" onClick={() => setReleves(releves.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn-mini" onClick={add}>{s.beam.releveAdd}</button>
    </>
  );
}

function BeamSchemeControls() {
  const lang = useStore((s) => s.lang);
  const doc = useStore((s) => s.doc);
  const setSpan = useStore((s) => s.setSpan);
  const setStirrup = useStore((s) => s.setStirrup);
  const setTopBars = useStore((s) => s.setTopBars);
  const seedStirrupRegions = useStore((s) => s.seedStirrupRegions);
  const s = t(lang);
  if (!isBeamDoc(doc)) return null;
  const { span, stirrup, topBars } = doc;

  return (
    <>
      {/* v1.0.6 N3 (U3): the ONE unified section canvas now lives in the always-visible sidebar region. */}
      <h3>{s.beam.spanSteel}</h3>
      <DiameterSelect value={span.diameter} onChange={(v) => setSpan({ diameter: v })} />
      <Stepper label={s.beam.bottomBars} value={span.nBottom} min={2} max={8} onChange={(v) => setSpan({ nBottom: v })} />
      <NumberInput label={s.asRequired + " (mm²)"} value={span.asReq} min={0} max={20000} step={50} onChange={(v) => setSpan({ asReq: v })} />
      <FaconnageEditor
        key={`${doc.element}-${span.groupId}`}
        shapeId={span.shapeId}
        diameter={span.diameter}
        faconnage={span.faconnage}
        memberLength={doc.geometry.L}
        onChange={(patch) => setSpan(patch)}
      />
      <AddressableBars />
      <SpliceEditor />

      <h3>{s.beam.montageTitle}</h3>
      <label className="field field-check">
        <input type="checkbox" checked={topBars.enabled} onChange={(e) => setTopBars({ enabled: e.target.checked })} />
        <span className="field-label">{s.beam.montageEnable}</span>
      </label>
      {topBars.enabled && (
        <>
          <DiameterSelect value={topBars.diameter} onChange={(v) => setTopBars({ diameter: v })} />
          <Stepper label={s.beam.montageBars} value={topBars.nTop} min={2} max={8} onChange={(v) => setTopBars({ nTop: v })} />
        </>
      )}

      <SupportControls side="left" />
      <SupportControls side="right" />
      <ReleveEditor />

      <h3>{s.beam.stirrups}</h3>
      <DiameterSelect value={stirrup.diameter} onChange={(v) => setStirrup({ diameter: v })} />
      <NumberInput label={s.spacing} value={stirrup.spacing} min={50} max={400} step={5} onChange={(v) => setStirrup({ spacing: v })} />
      <NumberInput label="Asw,req (mm²/m)" value={stirrup.aswReqPerM} min={0} max={2000} step={10} onChange={(v) => setStirrup({ aswReqPerM: v })} />
      <button type="button" className="btn-mini" onClick={seedStirrupRegions}>{s.beam.seedRegions}</button>

      <CrossTieEditor />
      <RegionEditor />
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
            <Stepper label={s.generic.count} value={z.count ?? 0} min={0} max={40} onChange={(v) => setZone(z.groupId, { count: v })} />
          ) : (
            <NumberInput label={s.spacing} value={z.spacing ?? 150} min={50} max={400} step={5} onChange={(v) => setZone(z.groupId, { spacing: v })} />
          )}
          {z.kind === "transverse" ? (
            <NumberInput label="Asw,req (mm²/m)" value={z.asReqPerM ?? 0} min={0} max={2000} step={10} onChange={(v) => setZone(z.groupId, { asReqPerM: v })} />
          ) : z.control === "count" ? (
            <NumberInput label={s.asRequired + " (mm²)"} value={z.asReq ?? 0} min={0} max={40000} step={50} onChange={(v) => setZone(z.groupId, { asReq: v })} />
          ) : (
            <NumberInput label={s.generic.asReqPerM} value={z.asReqPerM ?? 0} min={0} max={4000} step={10} onChange={(v) => setZone(z.groupId, { asReqPerM: v })} />
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
          <NumberInput label={s.generic.cornerTorsion} value={doc.cornerTorsionProvided ?? 0} min={0} max={2000} step={10} onChange={(v) => setGenericFlag({ cornerTorsionProvided: v })} />
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
        <Stepper
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
  const setCodePack = useStore((s) => s.setCodePack);
  const s = t(lang);

  return (
    <div className="tab-body">
      <h3>{s.material.title}</h3>
      {/* A3/H13 ([v1.0.4]): pick the design code — BAEL↔EC2 swaps only the numbers (D-P1-3). */}
      <label className="field">
        <span className="field-label">{s.codePack}</span>
        <select value={doc.codePack ?? "BAEL"} aria-label={s.codePack} onChange={(e) => setCodePack(e.target.value as CodePackId)}>
          <option value="BAEL">BAEL 91-99</option>
          <option value="EC2">Eurocode 2</option>
        </select>
      </label>
      <NumberInput label={s.material.concrete} value={doc.material.f_c28} min={20} max={60} step={1} onChange={(v) => setMaterial({ f_c28: v })} />
      <NumberInput label={s.material.steel} value={doc.material.f_e} min={400} max={600} step={50} onChange={(v) => setMaterial({ f_e: v })} />
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
  const doc = useStore((s) => s.doc);
  const advancedForm = useStore((s) => s.advancedForm);
  const setAdvancedForm = useStore((s) => s.setAdvancedForm);
  const [tab, setTab] = useState<Tab>("scheme");
  const s = t(lang);

  // v1.0.6 N4 (U1): the left region is now the INSPECTOR region the form used to own. The contextual
  // inspector edits the object picked on the section dock's canvas / the 3D; the compact setup strip is
  // always visible; the full tabbed form stays behind the "Avancé" toggle (a complete fallback). The
  // ONE section canvas moved OUT of here into the section dock (N4 shell) — the inspector reads the
  // unified selection, so it works whichever surface the pick came from.
  const drawingFirst = isColumnDoc(doc) || isBeamDoc(doc);

  return (
    <aside className="sidebar">
      <ZoneReadout />
      <ElementSetupStrip />
      {drawingFirst && <Inspector />}
      <button
        type="button"
        className="advanced-toggle"
        aria-expanded={advancedForm}
        aria-pressed={advancedForm}
        title={s.setup.advancedHint}
        onClick={() => setAdvancedForm(!advancedForm)}
      >
        {advancedForm ? "▾" : "▸"} {s.setup.advanced}
      </button>
      {advancedForm && (
        <>
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
        </>
      )}
    </aside>
  );
}
