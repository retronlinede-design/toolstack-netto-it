import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ToolStack — Netto-It (German Net Salary Estimator) — v1
 * Paste into: src/App.jsx
 * Requires: Tailwind v4 configured
 *
 * UI Lock (Check-It master):
 * - bg-neutral-50, text-neutral-800/700
 * - Primary buttons: bg-neutral-700 text-white
 * - Lime accent separators/pills
 * - Normalized Top Actions grid + pinned ? Help
 * - Print preview prints ONLY the preview sheet
 *
 * IMPORTANT:
 * - Estimate only (not payroll-grade)
 */

const APP_ID = "nettoit";
const APP_VERSION = "v1";
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;
const PROFILE_KEY = "toolstack.profile.v1";

// Put your real ToolStack hub URL here (Wix page)
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

// ---------- formatting/helpers ----------
const EUR = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const floorEuro = (n) => Math.floor((Number.isFinite(n) ? n : 0) + 1e-9);

function safeNum(v, fallback = 0) {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
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

// ---------- 2026 defaults (estimate-friendly) ----------
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

// ---------- Tax (2026 tariff) — estimate ----------
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
          ? "Private health selected: statutory KV/PV shown as 0. Private premiums are NOT included."
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

// ---------- UI tokens (Check-It master) ----------
const inputBase =
  "w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300";

const card = "rounded-2xl bg-white border border-neutral-200 shadow-sm";
const cardPad = "p-4";

const ACTION_BASE =
  "print:hidden h-10 w-full rounded-xl text-sm font-medium border transition shadow-sm active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

function ActionButton({ children, onClick, disabled, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${ACTION_BASE} bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200`}
    >
      {children}
    </button>
  );
}

function Pill({ children, tone = "default" }) {
  const cls =
    tone === "accent"
      ? "border-lime-200 bg-lime-50 text-neutral-800"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-neutral-800"
      : "border-neutral-200 bg-white text-neutral-800";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {children}
    </span>
  );
}

function StatRow({ label, value, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="text-sm text-neutral-700">
        <div className="font-semibold text-neutral-800">{label}</div>
        {hint ? <div className="text-xs text-neutral-500">{hint}</div> : null}
      </div>
      <div className="text-sm font-bold text-neutral-800 tabular-nums">{value}</div>
    </div>
  );
}

// Help Pack v1 (same structure as Check-It) + Netto-It limits
function HelpModal({ open, onClose, onReset }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-neutral-800">Help</div>
            <div className="text-sm text-neutral-700 mt-1">How saving works in ToolStack apps.</div>
            <div className="mt-3 h-[2px] w-52 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-neutral-700">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Autosave (default)</div>
            <p className="mt-1">
              Your data saves automatically in this browser on this device (localStorage). If you clear browser data or
              switch devices, it won’t follow automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Export (backup / move devices)</div>
            <p className="mt-1">
              Use <span className="font-medium">Export</span> to download a JSON backup file. Save it somewhere safe
              (Drive/Dropbox/email to yourself).
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Import (restore)</div>
            <p className="mt-1">
              Use <span className="font-medium">Import</span> to load a previous JSON backup and continue.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Print / Save PDF</div>
            <p className="mt-1">
              Use <span className="font-medium">Preview</span> to open the report sheet, then{" "}
              <span className="font-medium">Print / Save PDF</span>. Printing is scoped to the preview sheet only.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Estimator limits (important)</div>
            <ul className="mt-2 list-disc pl-5">
              <li>Private health premiums are not modeled.</li>
              <li>Tax class V/VI are simplified approximations (not full ELStAM wage-tax tables).</li>
              <li>Care childless surcharge assumes age 23+ if children allowance is 0.</li>
              <li>This is an estimate — always verify with your payslip / official calculators.</li>
            </ul>
          </div>

          <div className="text-xs text-neutral-600">
            Tip: Export once a week (or after big updates) so you always have a clean backup.
          </div>

          <div className="text-xs text-neutral-600">
            Storage key: <span className="font-mono">{KEY}</span> • Reserved profile key:{" "}
            <span className="font-mono">{PROFILE_KEY}</span>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-100 flex items-center justify-between gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition"
            onClick={onReset}
          >
            Reset app data
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600 transition"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Printable report sheet ----------
function ReportSheet({ data, breakdown }) {
  const stateName = STATES.find((s) => s.id === data.state)?.name || data.state;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold tracking-tight text-neutral-800">
            Netto<span className="text-lime-500">It</span>
          </div>
          <div className="text-sm text-neutral-700">German net salary estimate (gross → net)</div>
          <div className="mt-3 h-[2px] w-72 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
        </div>
        <div className="text-sm text-neutral-700">Generated: {new Date().toLocaleString("de-DE")}</div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">Net (monthly est.)</div>
          <div className="text-2xl font-bold tabular-nums text-neutral-800 mt-1">{EUR(breakdown.netMonthly)}</div>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">Gross (monthly)</div>
          <div className="text-lg font-bold tabular-nums text-neutral-800 mt-1">{EUR(breakdown.grossMonthly)}</div>
          <div className="text-xs text-neutral-600 mt-1">Gross (annual): {EUR(breakdown.grossAnnual)}</div>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">Inputs</div>
          <div className="text-sm text-neutral-800 mt-1">Tax class: {String(data.taxClass)}</div>
          <div className="text-sm text-neutral-800 mt-1">State: {stateName}</div>
          <div className="text-sm text-neutral-800 mt-1">
            Health: {data.healthType === "private" ? "Private (PKV)" : "Public (GKV)"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="font-semibold text-neutral-800">Taxes (annual)</div>
          <div className="mt-2 space-y-1">
            <StatRow label="Income tax" value={EUR(breakdown.taxes.incomeTaxAnnual)} />
            <StatRow label="Solidarity surcharge" value={EUR(breakdown.taxes.soliAnnual)} />
            <StatRow
              label="Church tax"
              value={EUR(breakdown.taxes.churchAnnual)}
              hint={data.churchTax ? `Rate: ${Math.round(churchRateForState(data.state) * 100)}%` : undefined}
            />
            <div className="border-t border-neutral-200 pt-2">
              <StatRow label="Taxes total" value={EUR(breakdown.taxes.totalAnnual)} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="font-semibold text-neutral-800">Social (monthly)</div>
          <div className="mt-2 space-y-1">
            <StatRow label="Pension (RV)" value={EUR(breakdown.social.rv)} />
            <StatRow label="Unemployment (AV)" value={EUR(breakdown.social.av)} />
            <StatRow label="Health (KV)" value={EUR(breakdown.social.kv)} />
            <StatRow label="Care (PV)" value={EUR(breakdown.social.pv)} hint={breakdown.social.note} />
            <div className="border-t border-neutral-200 pt-2">
              <StatRow label="Social total" value={EUR(breakdown.social.total)} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        <div className="font-semibold text-neutral-800">Disclaimer</div>
        <ul className="mt-2 list-disc pl-5">
          <li>This is a simplified estimate. Your actual payroll net can differ.</li>
          <li>Tax class V/VI are approximations; private premiums are not modeled.</li>
          <li>Solidarity surcharge uses annual income tax thresholds (2026).</li>
        </ul>
        <div className="mt-2 text-xs text-neutral-600">
          Storage key: <span className="font-mono">{KEY}</span>
        </div>
      </div>
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
  const [importing, setImporting] = useState(false);

  const fileRef = useRef(null);

  // Autosave
  useEffect(() => {
    const payload = { meta: { app: APP_ID, version: APP_VERSION, savedAt: new Date().toISOString() }, data };
    localStorage.setItem(KEY, JSON.stringify(payload));
  }, [data]);

  const breakdown = useMemo(() => estimateNet(data), [data]);

  const onExport = () => {
    downloadJson(`toolstack-${APP_ID}-${APP_VERSION}-${new Date().toISOString().slice(0, 10)}.json`, {
      meta: { app: APP_ID, version: APP_VERSION, exportedAt: new Date().toISOString() },
      data,
    });
  };

  const onImportPick = () => {
    setImporting(true);
    setTimeout(() => fileRef.current?.click(), 60);
  };

  const onImportFile = async (file) => {
    try {
      const json = await readJsonFile(file);
      const incoming = json?.data || json;
      setData({ ...defaultData, ...incoming });
    } catch {
      alert("Import failed: invalid JSON file.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const resetAppData = () => {
    const ok = window.confirm("Reset Netto-It data? This clears local storage for this app.");
    if (!ok) return;
    localStorage.removeItem(KEY);
    setData({ ...defaultData });
    setHelpOpen(false);
  };

  const openPreview = () => setPreviewOpen(true);

  const printFromPreview = () => {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 60);
  };

  const taxesMonthly = (breakdown.taxes.totalAnnual || 0) / 12;

  // -------- print scoping (print ONLY preview sheet) --------
  // Same approach as Vehicle Check-It: when preview is open, hide everything except #nettoit-print-preview
  const printScopeStyle = previewOpen
    ? `
      @media print {
        body * { visibility: hidden !important; }
        #nettoit-print-preview, #nettoit-print-preview * { visibility: visible !important; }
        #nettoit-print-preview { position: absolute !important; left: 0; top: 0; width: 100%; }
      }
    `
    : "";

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
        ${printScopeStyle}
      `}</style>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} onReset={resetAppData} />

      {/* Preview Modal */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />
          <div className="relative w-full max-w-5xl">
            <div className="mb-3 rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-neutral-800">Print preview</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition"
                  onClick={() => window.print()}
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600 transition"
                  onClick={() => setPreviewOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto max-h-[80vh]">
              <div id="nettoit-print-preview" className="p-6">
                <ReportSheet data={data} breakdown={breakdown} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-neutral-700">
              <span>Netto</span>
              <span className="text-[#D5FF00]">It</span>
            </div>
            <div className="text-sm text-neutral-700">German Nett Salary Calculator</div>
            <div className="mt-3 h-[2px] w-80 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="accent">Estimate</Pill>
              <Pill>Autosave</Pill>
              <Pill>Export/Import</Pill>
              <Pill>Print preview</Pill>
            </div>

            {HUB_URL && HUB_URL !== "https://YOUR-WIX-HUB-URL-HERE" ? (
              <a className="mt-3 inline-block text-sm font-semibold text-neutral-800 underline" href={HUB_URL} target="_blank" rel="noreferrer">
                Return to ToolStack hub
              </a>
            ) : null}
          </div>

          {/* Normalized top actions grid (with pinned help) */}
          <div className="w-full sm:w-[680px]">
            <div className="relative">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 pr-12">
                <ActionButton onClick={openPreview}>Preview</ActionButton>
                <ActionButton onClick={printFromPreview}>Print / Save PDF</ActionButton>
                <ActionButton onClick={onExport}>Export</ActionButton>
                <ActionButton onClick={onImportPick}>Import</ActionButton>
                <ActionButton onClick={() => setHelpOpen(true)}>Help</ActionButton>
              </div>

              <button
                type="button"
                title="Help"
                onClick={() => setHelpOpen(true)}
                className="print:hidden absolute right-0 top-0 h-10 w-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 shadow-sm flex items-center justify-center font-bold text-neutral-800"
                aria-label="Help"
              >
                ?
              </button>
            </div>
          </div>
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

        {/* Main grid */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inputs */}
          <div className={card}>
            <div className={cardPad}>
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-neutral-800">Inputs</div>
                <div className="text-xs text-neutral-600">Autosaves</div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">Gross monthly (€)</div>
                  <input
                    className={inputBase}
                    value={data.grossMonthly}
                    onChange={(e) => setData((d) => ({ ...d, grossMonthly: safeNum(e.target.value, 0) }))}
                    type="number"
                    min={0}
                    step="50"
                  />
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">Tax class (I–VI)</div>
                  <select
                    className={inputBase}
                    value={data.taxClass}
                    onChange={(e) => setData((d) => ({ ...d, taxClass: e.target.value }))}
                  >
                    {["I", "II", "III", "IV", "V", "VI"].map((tc) => (
                      <option key={tc} value={tc}>
                        {tc}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">Church tax</div>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!data.churchTax}
                      onChange={(e) => setData((d) => ({ ...d, churchTax: e.target.checked }))}
                      className="h-4 w-4 accent-lime-500"
                    />
                    <span className="text-sm font-medium text-neutral-800">Yes</span>
                  </div>
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">Children allowance</div>
                  <input
                    className={inputBase}
                    value={data.childAllowance}
                    onChange={(e) => setData((d) => ({ ...d, childAllowance: safeNum(e.target.value, 0) }))}
                    type="number"
                    min={0}
                    step="0.5"
                  />
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">State (Bundesland)</div>
                  <select
                    className={inputBase}
                    value={data.state}
                    onChange={(e) => setData((d) => ({ ...d, state: e.target.value }))}
                  >
                    {STATES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">Health insurance</div>
                  <select
                    className={inputBase}
                    value={data.healthType}
                    onChange={(e) => setData((d) => ({ ...d, healthType: e.target.value }))}
                  >
                    <option value="public">Public (GKV)</option>
                    <option value="private">Private (PKV)</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                <div className="font-semibold text-neutral-800">Estimate assumptions</div>
                <ul className="mt-2 list-disc pl-5">
                  <li>Social contributions use common 2026 rates + average Zusatzbeitrag.</li>
                  <li>Private health: statutory KV/PV are 0 here (private premium not modeled).</li>
                  <li>Care childless surcharge assumed if children allowance = 0 (and age 23+).</li>
                  <li>Tax class V/VI use simplified multipliers (MVP).</li>
                </ul>
              </div>

              <div className="mt-3 text-xs text-neutral-600">
                Storage key: <span className="font-mono">{KEY}</span>
              </div>
            </div>
          </div>

          {/* Output */}
          <div className={card}>
            <div className={cardPad}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-800">Output</div>
                  <div className="text-sm text-neutral-600">Gross → Social + Taxes → Net (estimate)</div>
                </div>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white shadow-sm hover:bg-neutral-600 active:translate-y-[1px] transition"
                  onClick={openPreview}
                >
                  Open Preview
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-bold tracking-wide text-neutral-600">NET (EST.)</div>
                <div className="mt-1 text-3xl font-black tabular-nums text-neutral-800">{EUR(breakdown.netMonthly)}</div>
                <div className="mt-1 text-sm text-neutral-600">per month</div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="text-xs font-bold text-neutral-600">Taxes (monthly)</div>
                    <div className="mt-1 text-lg font-black tabular-nums text-neutral-800">{EUR(taxesMonthly)}</div>
                    <div className="mt-2 space-y-1">
                      <StatRow label="Income tax" value={EUR((breakdown.taxes.incomeTaxAnnual || 0) / 12)} />
                      <StatRow label="Solidarity surcharge" value={EUR((breakdown.taxes.soliAnnual || 0) / 12)} />
                      <StatRow label="Church tax" value={EUR((breakdown.taxes.churchAnnual || 0) / 12)} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="text-xs font-bold text-neutral-600">Social (monthly)</div>
                    <div className="mt-1 text-lg font-black tabular-nums text-neutral-800">{EUR(breakdown.social.total)}</div>
                    <div className="mt-2 space-y-1">
                      <StatRow label="Pension (RV)" value={EUR(breakdown.social.rv)} />
                      <StatRow label="Unemployment (AV)" value={EUR(breakdown.social.av)} />
                      <StatRow label="Health (KV)" value={EUR(breakdown.social.kv)} />
                      <StatRow label="Care (PV)" value={EUR(breakdown.social.pv)} hint={breakdown.social.note} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-neutral-600">
                  Taxable income (annual estimate):{" "}
                  <span className="font-bold text-neutral-800">{EUR(breakdown.taxableIncomeAnnual)}</span>
                </div>
              </div>

              <div className="mt-4 text-sm text-neutral-700">
                <div className="font-semibold text-neutral-800">Quick read</div>
                <ul className="mt-2 list-disc pl-5">
                  <li>Gross: {EUR(breakdown.grossMonthly)} / month</li>
                  <li>Social: {EUR(breakdown.social.total)} / month</li>
                  <li>Taxes: {EUR(taxesMonthly)} / month</li>
                  <li>
                    Net (est.): <span className="font-bold">{EUR(breakdown.netMonthly)}</span> / month
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Import micro-state */}
        {importing ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-neutral-800 text-white px-4 py-3 shadow-xl print:hidden">
            <div className="text-sm">Importing…</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
