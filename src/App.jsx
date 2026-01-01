import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ToolStack — Netto-It (German Net Salary Estimator) — MVP (v1)
 * Paste into: src/App.jsx
 * Requires: Tailwind v4 configured
 *
 * ToolStack standard UI:
 * - Top actions grid: Preview / Print / Export / Import + pinned ? Help
 * - Help modal: Help Pack v1 (same layout/text pattern used across ToolStack)
 * - Autosave to localStorage + JSON export/import
 *
 * Note:
 * - This is an ESTIMATE, not a payroll-grade calculator.
 */

const APP_ID = "nettoit";
const APP_VERSION = "v1";
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;
const PROFILE_KEY = "toolstack.profile.v1";

// Optional (used in header link)
const HUB_URL = "";

const EUR = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const floorEuro = (n) => Math.floor((Number.isFinite(n) ? n : 0) + 1e-9);

const STATES = [
  { id: "BW", name: "Baden-Württemberg" },
  { id: "BY", name: "Bayern" },
  { id: "BE", name: "Berlin" },
  { id: "BB", name: "Brandenburg" },
  { id: "HB", name: "Bremen" },
  { id: "HH", name: "Hamburg" },
  { id: "HE", name: "Hessen" },
  { id: "MV", name: "Mecklenburg-Vorpommern" },
  { id: "NI", name: "Niedersachsen" },
  { id: "NW", name: "Nordrhein-Westfalen" },
  { id: "RP", name: "Rheinland-Pfalz" },
  { id: "SL", name: "Saarland" },
  { id: "SN", name: "Sachsen" },
  { id: "ST", name: "Sachsen-Anhalt" },
  { id: "SH", name: "Schleswig-Holstein" },
  { id: "TH", name: "Thüringen" },
];

// --- 2026 defaults (estimate-friendly)
const RATES_2026 = {
  // Social contribution caps (monthly)
  BBG_RV_AV_M: 8450.0, // Renten/Arbeitslosenversicherung
  BBG_KV_PV_M: 5812.5, // Kranken/Pflegeversicherung

  // Social contribution rates (total)
  RV_TOTAL: 0.186,
  AV_TOTAL: 0.026,
  KV_GENERAL_TOTAL: 0.146,
  KV_ADD_ON_AVG_TOTAL: 0.029, // average Zusatzbeitrag (estimate)
  PV_TOTAL: 0.036,
  PV_CHILDLESS_SURCHARGE: 0.006, // employee only (age 23+, if childless)

  // Flat deductions (annual)
  ARBEITNEHMER_PAUSCH: 1230,
  SONDERAUSG_PAUSCH: 36,

  // Children allowance (annual)
  KINDERFREIBETRAG_TOTAL_PER_CHILD: 9756,

  // Single parent relief (Steuerklasse II) (annual)
  ENTLASTUNG_1ST_CHILD: 4260,
  ENTLASTUNG_EACH_ADDITIONAL_CHILD: 240,

  // Soli
  SOLI_RATE: 0.055,
  SOLI_FREIGRENZE_SINGLE_ESt: 20350,
  SOLI_FREIGRENZE_SPLIT_ESt: 40700,
  SOLI_MILDERUNG_RATE: 0.119,
};

const defaultData = {
  grossMonthly: 3700,
  taxClass: "I",
  churchTax: false,
  childAllowance: 0,
  state: "BY",
  healthType: "public", // public | private
};

function safeNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

// --- Tax (2026 tariff) — estimate
function calcIncomeTax2026_Grundtarif(zve) {
  const x = Math.max(0, floorEuro(zve));
  if (x <= 12348) return 0;
  if (x <= 17799) {
    const y = (x - 12348) / 10000;
    return floorEuro((914.51 * y + 1400) * y);
  }
  if (x <= 69878) {
    const z = (x - 17799) / 10000;
    return floorEuro((173.1 * z + 2397) * z + 1034.87);
  }
  if (x <= 277825) return floorEuro(0.42 * x - 11135.63);
  return floorEuro(0.45 * x - 19470.38);
}

function calcIncomeTax2026(zve, taxClass) {
  const tc = String(taxClass || "I").toUpperCase();
  const base = calcIncomeTax2026_Grundtarif(zve);

  if (tc === "III") {
    const half = Math.max(0, floorEuro(zve / 2));
    return floorEuro(calcIncomeTax2026_Grundtarif(half) * 2);
  }

  // simplified approximations (MVP)
  if (tc === "V") return floorEuro(base * 1.35);
  if (tc === "VI") return floorEuro(base * 1.5);

  return base; // I, II, IV
}

function isSplittingClass(taxClass) {
  return String(taxClass || "").toUpperCase() === "III";
}

function calcSoliFromESt(est, splitting) {
  const ESt = Math.max(0, floorEuro(est));
  const freigrenze = splitting ? RATES_2026.SOLI_FREIGRENZE_SPLIT_ESt : RATES_2026.SOLI_FREIGRENZE_SINGLE_ESt;
  if (ESt <= freigrenze) return 0;
  const full = RATES_2026.SOLI_RATE * ESt;
  const mild = RATES_2026.SOLI_MILDERUNG_RATE * (ESt - freigrenze);
  return floorEuro(Math.min(full, mild));
}

function churchRateForState(stateId) {
  const s = String(stateId || "").toUpperCase();
  return s === "BY" || s === "BW" ? 0.08 : 0.09;
}

function estimateNet(data) {
  const grossMonthly = clamp(safeNum(data.grossMonthly, 0), 0, 1_000_000);
  const grossAnnual = grossMonthly * 12;

  const taxClass = String(data.taxClass || "I").toUpperCase();
  const churchTax = !!data.churchTax;
  const childAllowance = clamp(safeNum(data.childAllowance, 0), 0, 10);
  const state = String(data.state || "BY").toUpperCase();
  const healthType = data.healthType === "private" ? "private" : "public";

  const childrenCount = childAllowance > 0 ? Math.ceil(childAllowance) : 0;

  // --- Social (employee share)
  const rvBaseM = Math.min(grossMonthly, RATES_2026.BBG_RV_AV_M);
  const kvBaseM = Math.min(grossMonthly, RATES_2026.BBG_KV_PV_M);

  const rvEmpM = rvBaseM * (RATES_2026.RV_TOTAL / 2);
  const avEmpM = rvBaseM * (RATES_2026.AV_TOTAL / 2);

  const kvEmpM =
    healthType === "public"
      ? kvBaseM * ((RATES_2026.KV_GENERAL_TOTAL + RATES_2026.KV_ADD_ON_AVG_TOTAL) / 2)
      : 0;

  const pvBaseEmp = healthType === "public" ? kvBaseM * (RATES_2026.PV_TOTAL / 2) : 0;
  const pvChildless =
    healthType === "public" && childrenCount === 0 ? kvBaseM * RATES_2026.PV_CHILDLESS_SURCHARGE : 0;
  const pvEmpM = pvBaseEmp + pvChildless;

  const socialEmpM = rvEmpM + avEmpM + kvEmpM + pvEmpM;
  const socialEmpA = socialEmpM * 12;

  // --- zvE estimate
  let zve = grossAnnual;
  zve -= socialEmpA;
  zve -= RATES_2026.ARBEITNEHMER_PAUSCH;
  zve -= RATES_2026.SONDERAUSG_PAUSCH;
  zve -= childAllowance * RATES_2026.KINDERFREIBETRAG_TOTAL_PER_CHILD;

  if (taxClass === "II") {
    const relief =
      RATES_2026.ENTLASTUNG_1ST_CHILD + Math.max(0, childrenCount - 1) * RATES_2026.ENTLASTUNG_EACH_ADDITIONAL_CHILD;
    zve -= relief;
  }

  zve = Math.max(0, zve);

  const estA = calcIncomeTax2026(zve, taxClass);
  const soliA = calcSoliFromESt(estA, isSplittingClass(taxClass));
  const kircheA = churchTax ? floorEuro(estA * churchRateForState(state)) : 0;
  const taxesA = estA + soliA + kircheA;

  const netAnnual = grossAnnual - socialEmpA - taxesA;
  const netMonthly = netAnnual / 12;

  return {
    grossMonthly,
    grossAnnual,
    taxableIncomeAnnual: zve,
    social: {
      rv: rvEmpM,
      av: avEmpM,
      kv: kvEmpM,
      pv: pvEmpM,
      total: socialEmpM,
      note:
        healthType === "private"
          ? "Private health selected: statutory health/care contributions are shown as 0. Private premiums are NOT included."
          : childrenCount === 0
          ? "Includes childless care surcharge (0.6%) if 23+."
          : "Care surcharge not applied (children allowance > 0).",
    },
    taxes: {
      incomeTaxAnnual: estA,
      soliAnnual: soliA,
      churchAnnual: kircheA,
      totalAnnual: taxesA,
    },
    netMonthly,
    netAnnual,
  };
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "{}")));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// --- UI helpers (ToolStack look)
function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function Btn({ children, onClick, variant = "ghost", title, className = "", type = "button" }) {
  const base =
    "rounded-2xl px-3 py-2 text-sm font-semibold shadow-sm transition active:translate-y-[1px]";
  const styles = {
    ghost: "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
    primary: "bg-lime-600 text-white hover:bg-lime-700",
    dark: "bg-zinc-900 text-white hover:bg-zinc-800",
  };
  return (
    <button type={type} title={title} onClick={onClick} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
      {children}
    </span>
  );
}

function Modal({ open, title, children, onClose, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-zinc-950/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div className="font-bold text-zinc-900">{title}</div>
            <button
              onClick={onClose}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Close
            </button>
          </div>
          <div className="max-h-[78vh] overflow-auto p-5">{children}</div>
          {footer ? <div className="border-t border-zinc-200 px-5 py-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="text-sm text-zinc-700">
        <div className="font-semibold text-zinc-900">{label}</div>
        {hint ? <div className="text-xs text-zinc-500">{hint}</div> : null}
      </div>
      <div className="text-sm font-bold text-zinc-900 tabular-nums">{value}</div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaultData };
      const parsed = JSON.parse(raw);
      return { ...defaultData, ...(parsed?.data || parsed || {}) };
    } catch {
      return { ...defaultData };
    }
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [printRequested, setPrintRequested] = useState(false);

  const fileRef = useRef(null);

  // Autosave
  useEffect(() => {
    const payload = { meta: { app: APP_ID, version: APP_VERSION, savedAt: new Date().toISOString() }, data };
    localStorage.setItem(KEY, JSON.stringify(payload));
  }, [data]);

  const breakdown = useMemo(() => estimateNet(data), [data]);

  // Print only preview sheet
  useEffect(() => {
    if (!previewOpen || !printRequested) return;
    const t = setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 120);
    return () => clearTimeout(t);
  }, [previewOpen, printRequested]);

  const onExport = () => {
    downloadJson(`toolstack-${APP_ID}-${APP_VERSION}-${new Date().toISOString().slice(0, 10)}.json`, {
      meta: { app: APP_ID, version: APP_VERSION, exportedAt: new Date().toISOString() },
      data,
    });
  };

  const onImportPick = () => {
    setImportOpen(true);
    setTimeout(() => fileRef.current?.click(), 50);
  };

  const onImportFile = async (file) => {
    try {
      const json = await readJsonFile(file);
      const incoming = json?.data || json;
      setData({ ...defaultData, ...incoming });
    } catch {
      alert("Import failed: invalid JSON file.");
    } finally {
      setImportOpen(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const resetAppData = () => {
    if (!confirm("Reset Netto-It data? This clears local storage for this app.")) return;
    localStorage.removeItem(KEY);
    setData({ ...defaultData });
  };

  const TopActions = (
    <div className="grid grid-cols-5 gap-2">
      <Btn variant="ghost" onClick={() => setPreviewOpen(true)}>
        Preview
      </Btn>
      <Btn
        variant="ghost"
        onClick={() => {
          setPreviewOpen(true);
          setPrintRequested(true);
        }}
      >
        Print / Save PDF
      </Btn>
      <Btn variant="ghost" onClick={onExport}>
        Export
      </Btn>
      <Btn variant="ghost" onClick={onImportPick}>
        Import
      </Btn>
      <Btn variant="ghost" onClick={() => setHelpOpen(true)} title="Help" className="flex items-center justify-center">
        ?
      </Btn>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Print rules: print ONLY the preview sheet */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-sheet { display: block !important; }
          .print-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print mx-auto max-w-5xl p-4 sm:p-6">
        {/* Header (ToolStack standard vibe) */}
        <Card className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill>TOOLSTACK</Pill>
                <Pill>{APP_ID.toUpperCase()}</Pill>
                <Pill>{APP_VERSION.toUpperCase()}</Pill>
              </div>
              <div className="mt-2 text-2xl font-extrabold tracking-tight">Netto-It</div>
              <div className="mt-1 text-sm text-zinc-600">
                German net salary estimate (gross → net) with a simple breakdown.
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-lime-50 px-2.5 py-1 text-xs font-semibold text-lime-800 ring-1 ring-lime-200">
                  Estimate
                </span>
                <span className="text-xs text-zinc-500">Autosaves locally · Export for backups</span>
              </div>
              {HUB_URL ? (
                <a className="mt-2 inline-block text-sm font-semibold text-zinc-900 underline" href={HUB_URL}>
                  Return to ToolStack hub
                </a>
              ) : null}
            </div>
            <div className="w-full sm:w-[520px]">{TopActions}</div>
          </div>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Inputs */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-bold">Inputs</div>
              <div className="text-xs text-zinc-500">Autosaves</div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-600">Gross monthly (€)</span>
                <input
                  value={data.grossMonthly}
                  onChange={(e) => setData((d) => ({ ...d, grossMonthly: safeNum(e.target.value, 0) }))}
                  type="number"
                  min={0}
                  step="50"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-200"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-600">Tax class (I–VI)</span>
                <select
                  value={data.taxClass}
                  onChange={(e) => setData((d) => ({ ...d, taxClass: e.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-200"
                >
                  {["I", "II", "III", "IV", "V", "VI"].map((tc) => (
                    <option key={tc} value={tc}>
                      {tc}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-600">Church tax</span>
                <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!data.churchTax}
                    onChange={(e) => setData((d) => ({ ...d, churchTax: e.target.checked }))}
                    className="h-4 w-4 accent-lime-600"
                  />
                  <span className="text-sm font-semibold text-zinc-800">Yes</span>
                </div>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-600">Children allowance</span>
                <input
                  value={data.childAllowance}
                  onChange={(e) => setData((d) => ({ ...d, childAllowance: safeNum(e.target.value, 0) }))}
                  type="number"
                  min={0}
                  step="0.5"
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-200"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-600">State (Bundesland)</span>
                <select
                  value={data.state}
                  onChange={(e) => setData((d) => ({ ...d, state: e.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-200"
                >
                  {STATES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-zinc-600">Health insurance</span>
                <select
                  value={data.healthType}
                  onChange={(e) => setData((d) => ({ ...d, healthType: e.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-200"
                >
                  <option value="public">Public (GKV)</option>
                  <option value="private">Private (PKV)</option>
                </select>
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              <div className="font-bold text-zinc-900">Estimate assumptions</div>
              <ul className="mt-1 list-disc pl-5">
                <li>Social contributions use common 2026 rates + average Zusatzbeitrag.</li>
                <li>Private health: statutory KV/PV are 0 here (private premium not modeled).</li>
                <li>Care childless surcharge assumed if children allowance = 0 (and age 23+).</li>
                <li>Tax class V/VI use simplified multipliers (MVP).</li>
              </ul>
            </div>
          </Card>

          {/* Output */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-bold">Output</div>
              <Btn variant="primary" onClick={() => setPreviewOpen(true)}>
                Open Preview
              </Btn>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-bold tracking-wide text-zinc-500">NET (EST.)</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums">{EUR(breakdown.netMonthly)}</div>
              <div className="mt-1 text-sm text-zinc-600">per month</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs font-bold text-zinc-500">Taxes (monthly)</div>
                  <div className="mt-1 text-lg font-extrabold tabular-nums">
                    {EUR((breakdown.taxes.totalAnnual || 0) / 12)}
                  </div>
                  <div className="mt-2 space-y-1">
                    <StatRow label="Income tax" value={EUR((breakdown.taxes.incomeTaxAnnual || 0) / 12)} />
                    <StatRow label="Solidarity surcharge" value={EUR((breakdown.taxes.soliAnnual || 0) / 12)} />
                    <StatRow label="Church tax" value={EUR((breakdown.taxes.churchAnnual || 0) / 12)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="text-xs font-bold text-zinc-500">Social (monthly)</div>
                  <div className="mt-1 text-lg font-extrabold tabular-nums">{EUR(breakdown.social.total)}</div>
                  <div className="mt-2 space-y-1">
                    <StatRow label="Pension (RV)" value={EUR(breakdown.social.rv)} />
                    <StatRow label="Unemployment (AV)" value={EUR(breakdown.social.av)} />
                    <StatRow label="Health (KV)" value={EUR(breakdown.social.kv)} />
                    <StatRow label="Care (PV)" value={EUR(breakdown.social.pv)} hint={breakdown.social.note} />
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                Taxable income (annual estimate): <span className="font-bold">{EUR(breakdown.taxableIncomeAnnual)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Hidden import input */}
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
          }}
        />

        <div className="mt-5 text-xs text-zinc-500">
          Storage: <span className="font-mono">{KEY}</span>
        </div>
      </div>

      {/* Preview modal (printable sheet) */}
      <Modal
        open={previewOpen}
        title="Preview — Netto-It report"
        onClose={() => {
          setPreviewOpen(false);
          setPrintRequested(false);
        }}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-zinc-500">Print will include only this report sheet.</div>
            <div className="flex gap-2">
              <Btn
                variant="dark"
                onClick={() => {
                  setPrintRequested(true);
                }}
              >
                Print / Save PDF
              </Btn>
              <Btn variant="ghost" onClick={() => setPreviewOpen(false)}>
                Close
              </Btn>
            </div>
          </div>
        }
      >
        <div className="print-sheet">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold tracking-wide text-zinc-500">TOOLSTACK</div>
                <div className="text-xl font-extrabold">Netto-It — German Net Salary (Estimate)</div>
                <div className="text-sm text-zinc-600">Report generated {new Date().toLocaleString("de-DE")}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-zinc-500">Net (monthly est.)</div>
                <div className="text-2xl font-extrabold tabular-nums">{EUR(breakdown.netMonthly)}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="font-bold">Inputs</div>
                <div className="mt-2 space-y-1">
                  <StatRow label="Gross monthly" value={EUR(breakdown.grossMonthly)} />
                  <StatRow label="Tax class" value={String(data.taxClass)} />
                  <StatRow label="State" value={String(data.state)} />
                  <StatRow label="Church tax" value={data.churchTax ? "Yes" : "No"} />
                  <StatRow label="Children allowance" value={String(data.childAllowance)} />
                  <StatRow label="Health" value={data.healthType === "private" ? "Private (PKV)" : "Public (GKV)"} />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="font-bold">Summary</div>
                <div className="mt-2 space-y-1">
                  <StatRow label="Gross (annual)" value={EUR(breakdown.grossAnnual)} />
                  <StatRow label="Social (annual)" value={EUR((breakdown.social.total || 0) * 12)} />
                  <StatRow label="Taxes (annual)" value={EUR(breakdown.taxes.totalAnnual)} />
                  <div className="border-t border-zinc-200 pt-2">
                    <StatRow label="Net (annual est.)" value={EUR(breakdown.netAnnual)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 p-3">
                <div className="font-bold">Taxes breakdown (annual)</div>
                <div className="mt-2 space-y-1">
                  <StatRow label="Income tax" value={EUR(breakdown.taxes.incomeTaxAnnual)} />
                  <StatRow label="Solidarity surcharge" value={EUR(breakdown.taxes.soliAnnual)} />
                  <StatRow
                    label="Church tax"
                    value={EUR(breakdown.taxes.churchAnnual)}
                    hint={data.churchTax ? `Rate: ${Math.round(churchRateForState(data.state) * 100)}%` : undefined}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-3">
                <div className="font-bold">Social breakdown (monthly)</div>
                <div className="mt-2 space-y-1">
                  <StatRow label="Pension (RV)" value={EUR(breakdown.social.rv)} />
                  <StatRow label="Unemployment (AV)" value={EUR(breakdown.social.av)} />
                  <StatRow label="Health (KV)" value={EUR(breakdown.social.kv)} />
                  <StatRow label="Care (PV)" value={EUR(breakdown.social.pv)} hint={breakdown.social.note} />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              <div className="font-bold text-zinc-900">Disclaimer</div>
              <ul className="mt-1 list-disc pl-5">
                <li>This is a simplified estimate. Your actual payroll net can differ.</li>
                <li>Tax class V/VI are approximations; private health premiums are not modeled.</li>
                <li>Solidarity surcharge uses annual income tax thresholds (2026).</li>
              </ul>
              <div className="mt-2">Storage key: <span className="font-mono">{KEY}</span></div>
            </div>
          </Card>
        </div>
      </Modal>

      {/* Help modal (Help Pack v1) */}
      <Modal
        open={helpOpen}
        title="Help Pack (v1)"
        onClose={() => setHelpOpen(false)}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-zinc-500">Data is stored locally (autosave). Use Export/Import for backups.</div>
            <Btn variant="ghost" onClick={resetAppData}>
              Reset app data
            </Btn>
          </div>
        }
      >
        <div className="space-y-4">
          <Card className="p-4">
            <div className="font-bold">How this app saves your data</div>
            <div className="mt-2 text-sm text-zinc-700">
              This app autosaves your inputs to your browser <span className="font-mono">localStorage</span>. No account, no cloud.
            </div>
            <div className="mt-2 text-xs text-zinc-500">Storage key: {KEY}</div>
          </Card>

          <Card className="p-4">
            <div className="font-bold">Export / Import (recommended routine)</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700">
              <li><span className="font-semibold">Export</span> creates a JSON backup file of your current data.</li>
              <li><span className="font-semibold">Import</span> loads a previously exported JSON file.</li>
              <li>Do a quick export after important changes (or weekly) to avoid accidental data loss.</li>
            </ul>
          </Card>

          <Card className="p-4">
            <div className="font-bold">Print / Save PDF</div>
            <div className="mt-2 text-sm text-zinc-700">
              Use <span className="font-semibold">Preview</span> to open the report sheet, then <span className="font-semibold">Print / Save PDF</span>.
              Printing is scoped to the preview sheet only.
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-bold">Estimator limits (important)</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700">
              <li>Private health insurance premiums are not modeled.</li>
              <li>Tax class V/VI are approximations, not full ELStAM wage-tax tables.</li>
              <li>Care childless surcharge assumes age 23+ if children allowance is 0.</li>
              <li>Use official payroll tools or your payslip for final numbers.</li>
            </ul>
          </Card>

          <Card className="p-4">
            <div className="font-bold">Module-ready notes</div>
            <div className="mt-2 text-sm text-zinc-700">
              This module uses <span className="font-mono">{KEY}</span>. A shared profile key is reserved at <span className="font-mono">{PROFILE_KEY}</span>.
            </div>
          </Card>
        </div>
      </Modal>

      {/* Import micro-state */}
      {importOpen ? (
        <div className="no-print fixed bottom-3 left-0 right-0 z-40 mx-auto max-w-md px-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-sm font-semibold text-zinc-700 shadow-sm">
            Importing…
          </div>
        </div>
      ) : null}
    </div>
  );
}
