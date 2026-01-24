import React, { useEffect, useMemo, useRef, useState } from "react";
import nettoitHeading from "./assets/nettoit-heading.png";
import calcImg from "./assets/calc.png";

/**
 * ToolStack — Netto-It (German Net Salary Estimator) — v1
 * Paste into: src/App.jsx (or index.tsx as TSX works too)
 * Requires: Tailwind v4 configured
 *
 * UI Lock (Master Candidate):
 * - bg-neutral-50, text-neutral-800/700
 * - Accent: #D5FF00 (same as “It” in the heading)
 * - Normalized Top Actions grid + pinned ? Help
 * - Preview modal prints ONLY the preview sheet
 * - “Save PDF” label (printing happens via browser dialog)
 */

const APP_ID = "nettoit";
const APP_VERSION = "v1";
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;
const PROFILE_KEY = "toolstack.profile.v1";
const LANG_KEY = `${KEY}.lang`;

// Put your real ToolStack hub URL here (Wix page)
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

// Official reference calculator (BMF)
const OFFICIAL_URL =
  "https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Service/Abgabenrechner/interaktiver-abgabenrechner.html";

// Accent must match the “It” highlight across ALL ToolStack apps.
const ACCENT = "#D5FF00";
const ACCENT_RGB = "213 255 0"; // same color as ACCENT, in "r g b" format

// ---------- i18n (EN/DE) ----------
const I18N = {
  en: {
    language: "Language",

    titleTagline: "German Net Salary Calculator",
    returnHub: "Return to ToolStack hub",

    hub: "Hub",
    hubMissing: "Hub URL not set yet. Edit HUB_URL in the code.",

    preview: "Preview",
    savePdf: "Save PDF",
    export: "Export",
    import: "Import",
    help: "Help",

    printPreviewTitle: "Preview",
    close: "Close",

    inputs: "Inputs",
    output: "Output",
    autosaves: "Autosaves",

    grossMonthly: "Gross monthly (€)",
    taxClass: "Tax class (I–VI)",
    churchTax: "Church tax",
    yes: "Yes",
    childrenAllowance: "Children allowance",
    state: "State (Bundesland)",
    healthInsurance: "Health insurance",
    publicGkv: "Public (GKV)",
    privatePkv: "Private (PKV)",
    pkvPremiumMonthly: "Private premium (€/month)",

    officialTitle: "Official calculator (BMF)",
    officialBody: "Compare your result with the official calculator for a reference.",
    officialOpen: "Open BMF calculator",

    estimateAssumptions: "Estimate assumptions",
    assump1: "Social contributions use common 2026 rates + average Zusatzbeitrag.",
    assump2: "Private health: statutory KV/PV are 0 here. If you enter a PKV premium, it will be subtracted from net.",
    assump3: "Care childless surcharge assumed if children allowance = 0 (and age 23+).",
    assump4: "Tax class V/VI use simplified multipliers (MVP).",

    grossToNet: "Gross → Social + Taxes → Net (estimate)",
    openPreview: "OPEN PREVIEW",

    netEst: "NET (EST.)",
    perMonth: "per month",
    estimateFootnote: "Estimate only — not financial/tax advice. Results may differ from your payslip.",

    taxesMonthly: "Taxes (monthly)",
    socialMonthly: "Social (monthly)",

    incomeTax: "Income tax",
    soli: "Solidarity surcharge",
    church: "Church tax",

    pension: "Pension (RV)",
    unemployment: "Unemployment (AV)",
    health: "Health (KV)",
    care: "Care (PV)",

    taxableIncomeAnnual: "Taxable income (annual estimate):",

    quickRead: "Quick read",
    grossLine: "Gross",
    socialLine: "Social",
    taxesLine: "Taxes",
    netLine: "Net (est.)",

    importing: "Importing…",

    // Help
    helpSubtitle: "How saving works in ToolStack apps.",
    autosaveTitle: "Autosave (default)",
    autosaveBody:
      "Your data saves automatically in this browser on this device (localStorage). If you clear browser data or switch devices, it won’t follow automatically.",
    exportTitle: "Export (backup / move devices)",
    exportBody: "Use Export to download a JSON backup file. Save it somewhere safe (Drive/Dropbox/email to yourself).",
    importTitle: "Import (restore)",
    importBody: "Use Import to load a previous JSON backup and continue.",
    pdfTitle: "Save PDF",
    pdfBody:
      "Use Preview to open the report sheet, then Save PDF. This uses your browser’s print dialog (choose ‘Save as PDF’). Printing is scoped to the preview sheet only.",
    limitsTitle: "Estimator limits (important)",
    lim1: "PKV: Only an optional premium you enter is subtracted (no full PKV modeling).",
    lim2: "Tax class V/VI are simplified approximations (not full ELStAM wage-tax tables).",
    lim3: "Care childless surcharge assumes age 23+ if children allowance is 0.",
    lim4: "This is an estimate — always verify with your payslip / official calculators.",
    tip: "Tip: Export once a week (or after big updates) so you always have a clean backup.",
    storageKey: "Storage key:",
    reservedProfileKey: "Reserved profile key:",

    resetAppData: "Reset app data",
    gotIt: "Got it",
    resetConfirm: "Reset Netto-It data? This clears local storage for this app.",
    importFailed: "Import failed: invalid JSON file.",

    // Report
    reportSubtitle: "German net salary estimate (gross → net)",
    generated: "Generated:",
    netMonthlyEst: "Net (monthly est.)",
    grossMonthlyLabel: "Gross (monthly)",
    grossAnnualLabel: "Gross (annual):",
    reportInputs: "Inputs",
    reportTaxClass: "Tax class:",
    reportState: "State:",
    reportHealth: "Health:",
    taxesAnnual: "Taxes (annual)",
    taxesTotal: "Taxes total",
    socialTotal: "Social total",
    disclaimer: "Disclaimer",
    disc1: "This is a simplified estimate. Your actual payroll net can differ.",
    disc2: "Tax class V/VI are approximations; PKV is only modeled via optional premium input.",
    disc3: "Solidarity surcharge uses annual income tax thresholds (2026).",

    // Notes
    notePrivate:
      "Private health selected: statutory KV/PV shown as 0. If you enter a PKV premium, it is subtracted from net.",
    noteChildless: "Includes childless care surcharge (0.6%) if 23+.",
    noteWithKids: "Care surcharge not applied (children allowance > 0).",
    actionsSubtitle: "Manage your data and results.",
  },

  de: {
    language: "Sprache",

    titleTagline: "Deutscher Netto-Lohnrechner",
    returnHub: "Zur ToolStack-Übersicht",

    hub: "Hub",
    hubMissing: "Hub-URL ist noch nicht gesetzt. Bitte HUB_URL im Code eintragen.",

    preview: "Vorschau",
    savePdf: "PDF speichern",
    export: "Export",
    import: "Import",
    help: "Hilfe",

    printPreviewTitle: "Vorschau",
    close: "Schließen",

    inputs: "Eingaben",
    output: "Ergebnis",
    autosaves: "Autospeichert",

    grossMonthly: "Brutto monatlich (€)",
    taxClass: "Steuerklasse (I–VI)",
    churchTax: "Kirchensteuer",
    yes: "Ja",
    childrenAllowance: "Kinderfreibetrag",
    state: "Bundesland",
    healthInsurance: "Krankenversicherung",
    publicGkv: "Gesetzlich (GKV)",
    privatePkv: "Privat (PKV)",
    pkvPremiumMonthly: "PKV-Prämie (€/Monat)",

    officialTitle: "Amtlicher Rechner (BMF)",
    officialBody: "Vergleiche dein Ergebnis zur Orientierung mit dem amtlichen Rechner.",
    officialOpen: "BMF-Rechner öffnen",

    estimateAssumptions: "Schätz-Annahmen",
    assump1: "Sozialabgaben nutzen gängige 2026-Sätze + durchschnittlichen Zusatzbeitrag.",
    assump2:
      "Private KV: gesetzliche KV/PV sind hier 0. Wenn du eine PKV-Prämie einträgst, wird sie vom Netto abgezogen.",
    assump3: "PV-Zuschlag für Kinderlose angenommen, wenn Kinderfreibetrag = 0 (und Alter 23+).",
    assump4: "Steuerklasse V/VI: vereinfachte Multiplikatoren (MVP).",

    grossToNet: "Brutto → Sozial + Steuern → Netto (Schätzung)",
    openPreview: "VORSCHAU ÖFFNEN",

    netEst: "NETTO (SCHÄTZ.)",
    perMonth: "pro Monat",
    estimateFootnote: "Nur Schätzung — keine Steuer-/Finanzberatung. Ergebnis kann von der Lohnabrechnung abweichen.",

    taxesMonthly: "Steuern (monatlich)",
    socialMonthly: "Sozial (monatlich)",

    incomeTax: "Lohn-/Einkommensteuer",
    soli: "Solidaritätszuschlag",
    church: "Kirchensteuer",

    pension: "Rente (RV)",
    unemployment: "Arbeitslosigkeit (AV)",
    health: "Kranken (KV)",
    care: "Pflege (PV)",

    taxableIncomeAnnual: "Zu versteuerndes Einkommen (jährl. Schätzung):",

    quickRead: "Kurzüberblick",
    grossLine: "Brutto",
    socialLine: "Sozial",
    taxesLine: "Steuern",
    netLine: "Netto (Schätz.)",

    importing: "Import läuft…",

    // Help
    helpSubtitle: "So funktioniert das Speichern in ToolStack-Apps.",
    autosaveTitle: "Autosave (Standard)",
    autosaveBody:
      "Deine Daten speichern automatisch in diesem Browser auf diesem Gerät (localStorage). Wenn du Browserdaten löschst oder das Gerät wechselst, sind sie nicht automatisch dabei.",
    exportTitle: "Export (Backup / Gerätewechsel)",
    exportBody:
      "Nutze Export, um eine JSON-Backup-Datei herunterzuladen. Speichere sie sicher (Drive/Dropbox/mail an dich selbst).",
    importTitle: "Import (Wiederherstellen)",
    importBody: "Nutze Import, um ein früheres JSON-Backup zu laden und weiterzumachen.",
    pdfTitle: "PDF speichern",
    pdfBody:
      "Nutze Vorschau, um das Blatt zu öffnen, dann PDF speichern. Das nutzt den Druckdialog (‚Als PDF speichern‘). Gedruckt wird nur die Vorschau-Seite.",
    limitsTitle: "Grenzen der Schätzung (wichtig)",
    lim1: "PKV: Es wird nur eine optional eingetragene Prämie abgezogen (keine vollständige PKV-Modellierung).",
    lim2: "Steuerklasse V/VI sind vereinfachte Näherungen (keine vollständigen ELStAM-Tabellen).",
    lim3: "PV-Zuschlag für Kinderlose wird angenommen (Alter 23+), wenn Kinderfreibetrag = 0.",
    lim4: "Das ist eine Schätzung — bitte mit Lohnabrechnung/amtlichen Rechnern prüfen.",
    tip: "Tipp: Exportiere 1× pro Woche (oder nach großen Updates), dann hast du immer ein sauberes Backup.",
    storageKey: "Storage-Key:",
    reservedProfileKey: "Profil-Key (reserviert):",

    resetAppData: "App-Daten zurücksetzen",
    gotIt: "Alles klar",
    resetConfirm: "Netto-It Daten zurücksetzen? Das löscht den localStorage dieser App.",
    importFailed: "Import fehlgeschlagen: ungültige JSON-Datei.",

    // Report
    reportSubtitle: "Netto-Schätzung (Brutto → Netto)",
    generated: "Erstellt:",
    netMonthlyEst: "Netto (monatlich, Schätz.)",
    grossMonthlyLabel: "Brutto (monatlich)",
    grossAnnualLabel: "Brutto (jährlich):",
    reportInputs: "Eingaben",
    reportTaxClass: "Steuerklasse:",
    reportState: "Bundesland:",
    reportHealth: "KV:",
    taxesAnnual: "Steuern (jährlich)",
    taxesTotal: "Steuern gesamt",
    socialTotal: "Sozial gesamt",
    disclaimer: "Hinweis",
    disc1: "Das ist eine vereinfachte Schätzung. Dein tatsächliches Netto kann abweichen.",
    disc2: "Steuerklasse V/VI sind Näherungen; PKV nur über optional eingetragene Prämie.",
    disc3: "Soli nutzt jährliche Einkommensteuer-Schwellen (2026).",

    // Notes
    notePrivate:
      "Private KV gewählt: gesetzliche KV/PV wird hier als 0 gezeigt. Eine eingetragene PKV-Prämie wird vom Netto abgezogen.",
    noteChildless: "PV-Zuschlag für Kinderlose (0,6%) enthalten, wenn 23+.",
    noteWithKids: "Kein Kinderlosen-Zuschlag (Kinderfreibetrag > 0).",
    actionsSubtitle: "Daten verwalten und Ergebnisse.",
  },
};

const detectLang = () => {
  try {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    return String(nav).toLowerCase().startsWith("de") ? "de" : "en";
  } catch {
    return "en";
  }
};

const tFor = (lang, key) => I18N[lang]?.[key] ?? I18N.en[key] ?? key;

// ---------- formatting/helpers ----------
const EUR = (n, locale = "de-DE") =>
  (Number.isFinite(n) ? n : 0).toLocaleString(locale, {
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

// UX: when focusing an input, select all text so typing replaces immediately
const selectAllOnFocus = (e) => {
  const el = e?.target;
  if (!el) return;
  requestAnimationFrame(() => {
    try {
      if (typeof el.select === "function") el.select();
      const len = String(el.value ?? "").length;
      if (typeof el.setSelectionRange === "function") el.setSelectionRange(0, len);
    } catch {
      // ignore
    }
  });
};

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
  { id: "BW", de: "Baden-Württemberg", en: "Baden-Württemberg" },
  { id: "BY", de: "Bayern", en: "Bavaria" },
  { id: "BE", de: "Berlin", en: "Berlin" },
  { id: "BB", de: "Brandenburg", en: "Brandenburg" },
  { id: "HB", de: "Bremen", en: "Bremen" },
  { id: "HH", de: "Hamburg", en: "Hamburg" },
  { id: "HE", de: "Hessen", en: "Hesse" },
  { id: "MV", de: "Mecklenburg-Vorpommern", en: "Mecklenburg-Vorpommern" },
  { id: "NI", de: "Niedersachsen", en: "Lower Saxony" },
  { id: "NW", de: "Nordrhein-Westfalen", en: "North Rhine-Westphalia" },
  { id: "RP", de: "Rheinland-Pfalz", en: "Rhineland-Palatinate" },
  { id: "SL", de: "Saarland", en: "Saarland" },
  { id: "SN", de: "Sachsen", en: "Saxony" },
  { id: "ST", de: "Sachsen-Anhalt", en: "Saxony-Anhalt" },
  { id: "SH", de: "Schleswig-Holstein", en: "Schleswig-Holstein" },
  { id: "TH", de: "Thüringen", en: "Thuringia" },
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
  pkvPremiumMonthly: 0,
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

function estimateNet(data, lang) {
  const grossMonthly = clamp(safeNum(data.grossMonthly, 0), 0, 1_000_000);
  const grossAnnual = grossMonthly * 12;

  const taxClass = String(data.taxClass || "I").toUpperCase();
  const churchTax = !!data.churchTax;
  const childAllowance = clamp(safeNum(data.childAllowance, 0), 0, 10);
  const state = String(data.state || "BY").toUpperCase();
  const healthType = data.healthType === "private" ? "private" : "public";

  const childrenCount = childAllowance > 0 ? Math.ceil(childAllowance) : 0;

  const pkvPremiumMonthly = healthType === "private" ? clamp(safeNum(data.pkvPremiumMonthly, 0), 0, 10000) : 0;
  const pkvPremiumAnnual = pkvPremiumMonthly * 12;

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
  const pvChildless = healthType === "public" && childrenCount === 0 ? kvBaseM * RATES_2026.PV_CHILDLESS_SURCHARGE : 0;
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

  const netAnnual = grossAnnual - socialEmpA - taxesA - pkvPremiumAnnual;
  const netMonthly = netAnnual / 12;

  const noteKey = healthType === "private" ? "notePrivate" : childrenCount === 0 ? "noteChildless" : "noteWithKids";

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
      note: tFor(lang, noteKey),
    },
    taxes: {
      incomeTaxAnnual: estA,
      soliAnnual: soliA,
      churchAnnual: kircheA,
      totalAnnual: taxesA,
    },
    netMonthly,
    netAnnual,
    pkvPremiumMonthly,
  };
}

// ---------- UI tokens (Master) ----------
// IMPORTANT: these are static Tailwind arbitrary values referencing CSS vars.
// This avoids fragile dynamic template classes, and works across apps.
const inputBase =
  "w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-800 " +
  "focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ts-accent-rgb)/0.25)] focus:border-[var(--ts-accent)]";

const card = "rounded-2xl bg-white border border-neutral-200 shadow-sm";
const cardPad = "p-4";

const ACTION_BASE =
  "print:hidden h-10 w-full rounded-xl text-sm font-medium border transition shadow-sm " +
  "active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

function ActionButton({ children, onClick, disabled, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={
        ACTION_BASE +
        " bg-white text-neutral-800 border-neutral-200 " +
        "hover:bg-[rgb(var(--ts-accent-rgb)/0.30)] hover:border-[var(--ts-accent)]"
      }
    >
      {children}
    </button>
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

function LanguageToggle({ lang, setLang }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-full border border-neutral-200/50">
      {["en", "de"].map((code) => {
        const isActive = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={
              "relative px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 " +
              (isActive
                ? "bg-[var(--ts-accent)] text-neutral-900 shadow-sm scale-105"
                : "text-neutral-500 hover:text-neutral-900 hover:bg-white/60")
            }
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function HelpItem({ icon, title, body }) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-5 hover:border-neutral-200 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm border border-neutral-100">
          {icon}
        </div>
        <div className="font-bold text-neutral-800 text-sm">{title}</div>
      </div>
      <div className="text-xs text-neutral-500 leading-relaxed">{body}</div>
    </div>
  );
}

function HelpModal({ open, onClose, onReset, lang }) {
  if (!open) return null;
  const t = (k) => tFor(lang, k);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col transform transition-all"
      >
        {/* Header */}
        <div className="shrink-0 p-6 border-b border-neutral-100 flex items-center justify-between bg-white z-10">
          <div>
            <div className="text-2xl font-black tracking-tight text-neutral-800">
              {t("help")} <span style={{ color: "var(--ts-accent)" }}>& Info</span>
            </div>
            <div className="text-sm text-neutral-700 mt-1">{t("helpSubtitle")}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HelpItem icon="💾" title={t("autosaveTitle")} body={t("autosaveBody")} />
            <HelpItem icon="📤" title={t("exportTitle")} body={t("exportBody")} />
            <HelpItem icon="📥" title={t("importTitle")} body={t("importBody")} />
            <HelpItem icon="📄" title={t("pdfTitle")} body={t("pdfBody")} />
          </div>

          {/* Limits (Warning style) */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
            <div className="flex items-center gap-2 mb-3 text-amber-900 font-bold">
              <span className="text-xl">⚠️</span>
              <span>{t("limitsTitle")}</span>
            </div>
            <ul className="space-y-2 text-sm text-amber-800/80 list-disc pl-5 marker:text-amber-400">
              <li>{t("lim1")}</li>
              <li>{t("lim2")}</li>
              <li>{t("lim3")}</li>
              <li>{t("lim4")}</li>
            </ul>
          </div>

          {/* Official Calculator (Dark card) */}
          <div className="rounded-2xl bg-neutral-900 p-6 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-[var(--ts-accent)] rounded-full opacity-20 blur-2xl group-hover:opacity-30 transition duration-500"></div>

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="font-bold text-lg text-white">{t("officialTitle")}</div>
                <div className="text-neutral-400 text-sm mt-1 max-w-md">{t("officialBody")}</div>
              </div>
              <a
                href={OFFICIAL_URL}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--ts-accent)] text-neutral-800 font-bold text-sm hover:brightness-110 transition shadow-lg shadow-[rgba(var(--ts-accent-rgb),0.2)]"
              >
                {t("officialOpen")}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
              </a>
            </div>
          </div>

          {/* Footer / Meta */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400 border-t border-neutral-100 mt-4">
            <div>
              {t("storageKey")} <span className="font-mono text-neutral-500">{KEY}</span>
            </div>
            <button
              type="button"
              onClick={onReset}
              className="text-red-400 hover:text-red-600 font-medium transition underline decoration-red-200 underline-offset-2"
            >
              {t("resetAppData")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuButton({ icon, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-neutral-100 bg-white p-6 text-center transition-all hover:border-[var(--ts-accent)] hover:bg-[rgb(var(--ts-accent-rgb)/0.05)] active:scale-[0.98]"
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-2xl transition-colors group-hover:bg-[var(--ts-accent)] group-hover:text-neutral-800">
        {icon}
      </div>
      <div className="font-bold text-neutral-800">{label}</div>
      <div className="mt-1 text-xs font-medium text-neutral-500">{sub}</div>
    </button>
  );
}

function ExportMenu({ open, onClose, actions, lang }) {
  if (!open) return null;
  const t = (k) => tFor(lang, k);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 print:hidden">
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-lg transform overflow-hidden rounded-3xl bg-white shadow-2xl transition-all">
        <div className="bg-neutral-50/50 p-6 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <div className="text-xl font-black tracking-tight text-neutral-800">
              {t("export")} <span style={{ color: "var(--ts-accent)" }}>& Actions</span>
            </div>
            <div className="text-sm text-neutral-500 mt-1">{t("actionsSubtitle")}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MenuButton icon="👁️" label={t("preview")} sub="View report" onClick={() => { actions.preview(); onClose(); }} />
          <MenuButton icon="📄" label={t("savePdf")} sub="Print / PDF" onClick={() => { actions.pdf(); onClose(); }} />
          <MenuButton icon="↓" label={t("export")} sub="Backup JSON" onClick={() => { actions.export(); onClose(); }} />
          <MenuButton icon="↑" label={t("import")} sub="Restore JSON" onClick={() => { actions.import(); onClose(); }} />
        </div>

        <div className="bg-neutral-50 p-4 text-center text-xs text-neutral-400 font-medium">
          ToolStack Netto-It
        </div>
      </div>
    </div>
  );
}

// ---------- Printable report sheet ----------
function ReportSheet({ data, breakdown, lang }) {
  const t = (k) => tFor(lang, k);
  const locale = lang === "de" ? "de-DE" : "en-US";
  const stateObj = STATES.find((s) => s.id === data.state);
  const stateName = stateObj ? (lang === "de" ? stateObj.de : stateObj.en) : data.state;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-bold tracking-tight text-neutral-800">
            Netto<span style={{ color: ACCENT }}>It</span>
          </div>
          <div className="text-sm text-neutral-700">{t("reportSubtitle")}</div>
          <div className="mt-3 h-[2px] w-full rounded-full bg-[var(--ts-accent)]" />
        </div>
        <div className="text-sm text-neutral-700">
          {t("generated")} {new Date().toLocaleString(locale)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">{t("netMonthlyEst")}</div>
          <div className="text-2xl font-bold tabular-nums text-neutral-800 mt-1">{EUR(breakdown.netMonthly, locale)}</div>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">{t("grossMonthlyLabel")}</div>
          <div className="text-lg font-bold tabular-nums text-neutral-800 mt-1">{EUR(breakdown.grossMonthly, locale)}</div>
          <div className="text-xs text-neutral-600 mt-1">
            {t("grossAnnualLabel")} {EUR(breakdown.grossAnnual, locale)}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="text-sm text-neutral-600">{t("reportInputs")}</div>
          <div className="text-sm text-neutral-800 mt-1">
            {t("reportTaxClass")} {String(data.taxClass)}
          </div>
          <div className="text-sm text-neutral-800 mt-1">
            {t("reportState")} {stateName}
          </div>
          <div className="text-sm text-neutral-800 mt-1">
            {t("reportHealth")} {data.healthType === "private" ? t("privatePkv") : t("publicGkv")}
          </div>
          {data.healthType === "private" && (breakdown.pkvPremiumMonthly || 0) > 0 ? (
            <div className="text-sm text-neutral-800 mt-1">
              {t("pkvPremiumMonthly")} {EUR(breakdown.pkvPremiumMonthly, locale)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="font-semibold text-neutral-800">{t("taxesAnnual")}</div>
          <div className="mt-2 space-y-1">
            <StatRow label={t("incomeTax")} value={EUR(breakdown.taxes.incomeTaxAnnual, locale)} />
            <StatRow label={t("soli")} value={EUR(breakdown.taxes.soliAnnual, locale)} />
            <StatRow
              label={t("church")}
              value={EUR(breakdown.taxes.churchAnnual, locale)}
              hint={data.churchTax ? `Rate: ${Math.round(churchRateForState(data.state) * 100)}%` : undefined}
            />
            <div className="border-t border-neutral-200 pt-2">
              <StatRow label={t("taxesTotal")} value={EUR(breakdown.taxes.totalAnnual, locale)} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 p-4">
          <div className="font-semibold text-neutral-800">{t("socialMonthly")}</div>
          <div className="mt-2 space-y-1">
            <StatRow label={t("pension")} value={EUR(breakdown.social.rv, locale)} />
            <StatRow label={t("unemployment")} value={EUR(breakdown.social.av, locale)} />
            <StatRow label={t("health")} value={EUR(breakdown.social.kv, locale)} />
            <StatRow label={t("care")} value={EUR(breakdown.social.pv, locale)} hint={breakdown.social.note} />
            <div className="border-t border-neutral-200 pt-2">
              <StatRow label={t("socialTotal")} value={EUR(breakdown.social.total, locale)} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        <div className="font-semibold text-neutral-800">{t("disclaimer")}</div>
        <ul className="mt-2 list-disc pl-5">
          <li>{t("disc1")}</li>
          <li>{t("disc2")}</li>
          <li>{t("disc3")}</li>
        </ul>
        <div className="mt-2 text-xs text-neutral-600">
          {t("storageKey")} <span className="font-mono">{KEY}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- lightweight sanity tests (opt-in) ----------
function runNettoItSanityTests() {
  const nearly = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
  const assert = (name, ok) => {
    // eslint-disable-next-line no-console
    if (!ok) console.error(`[NettoIt test failed] ${name}`);
  };

  const base = {
    ...defaultData,
    grossMonthly: 3000,
    taxClass: "I",
    churchTax: false,
    childAllowance: 0,
    state: "BY",
    healthType: "public",
  };

  const r1 = estimateNet(base, "en");
  assert(
    "returns numbers",
    Number.isFinite(r1.netMonthly) && Number.isFinite(r1.social.total) && Number.isFinite(r1.taxes.totalAnnual)
  );

  const pkv = estimateNet({ ...base, healthType: "private", pkvPremiumMonthly: 200 }, "en");
  assert("pkv premium reduces net", pkv.netMonthly < r1.netMonthly);
  assert("pkv premium stored", nearly(pkv.pkvPremiumMonthly, 200));

  const zeroGross = estimateNet({ ...base, grossMonthly: 0 }, "en");
  assert("zero gross net is zero", nearly(zeroGross.netMonthly, 0));

  const withChurch = estimateNet({ ...base, churchTax: true }, "en");
  assert("church tax increases taxes", withChurch.taxes.totalAnnual > r1.taxes.totalAnnual);

  const withKids = estimateNet({ ...base, childAllowance: 1 }, "en");
  assert("kids removes childless PV surcharge", withKids.social.pv <= r1.social.pv);

  // Additional tests
  const tcV = estimateNet({ ...base, taxClass: "V" }, "en");
  assert("tax class V increases tax vs I", tcV.taxes.totalAnnual >= r1.taxes.totalAnnual);

  const tcIII = estimateNet({ ...base, taxClass: "III" }, "en");
  assert("tax class III returns finite values", Number.isFinite(tcIII.taxes.totalAnnual) && Number.isFinite(tcIII.netMonthly));
}

export default function App() {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "de" || saved === "en") return saved;
      return detectLang();
    } catch {
      return "en";
    }
  });

  const t = (k) => tFor(lang, k);
  const locale = lang === "de" ? "de-DE" : "en-US";

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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const fileRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  useEffect(() => {
    const payload = { meta: { app: APP_ID, version: APP_VERSION, savedAt: new Date().toISOString() }, data };
    localStorage.setItem(KEY, JSON.stringify(payload));
  }, [data]);

  // Optional sanity tests: add ?tests=1 to URL
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && String(window.location.search || "").includes("tests=1")) {
        runNettoItSanityTests();
      }
    } catch {
      // ignore
    }
  }, []);

  const breakdown = useMemo(() => estimateNet(data, lang), [data, lang]);

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
      alert(t("importFailed"));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const resetAppData = () => {
    const ok = window.confirm(t("resetConfirm"));
    if (!ok) return;
    localStorage.removeItem(KEY);
    setData({ ...defaultData });
    setHelpOpen(false);
  };

  const openPreview = () => setPreviewOpen(true);

  const savePdfFromPreview = () => {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 60);
  };

  const openHub = () => {
    try {
      const placeholder = "https://YOUR-WIX-HUB-URL-HERE";
      if (!HUB_URL || HUB_URL === placeholder) {
        alert(t("hubMissing"));
        return;
      }
      window.open(HUB_URL, "_blank", "noreferrer");
    } catch {
      // ignore
    }
  };

  const taxesMonthly = (breakdown.taxes.totalAnnual || 0) / 12;

  // -------- print scoping (print ONLY preview sheet) --------
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
    <div
      className="min-h-screen bg-neutral-50 text-neutral-800"
      style={{
        // CSS vars used by Tailwind arbitrary value classes
        "--ts-accent": ACCENT,
        "--ts-accent-rgb": ACCENT_RGB,
      }}
    >
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
        ${printScopeStyle}
      `}</style>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} onReset={resetAppData} lang={lang} />
      
      <ExportMenu 
        open={exportMenuOpen} 
        onClose={() => setExportMenuOpen(false)} 
        lang={lang}
        actions={{
          preview: openPreview,
          pdf: savePdfFromPreview,
          export: onExport,
          import: onImportPick
        }}
      />

      {/* Preview Modal */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />
          <div className="relative w-full max-w-5xl">
            <div className="mb-3 rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-neutral-800">{t("printPreviewTitle")}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-sm font-extrabold border border-[var(--ts-accent)] bg-[var(--ts-accent)] text-neutral-800 transition hover:brightness-95"
                  onClick={() => window.print()}
                >
                  {t("savePdf")}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600 transition"
                  onClick={() => setPreviewOpen(false)}
                >
                  {t("close")}
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto max-h-[80vh]">
              <div id="nettoit-print-preview" className="p-6">
                <ReportSheet data={data} breakdown={breakdown} lang={lang} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-6">
            <img
              src={nettoitHeading}
              alt="NettoIt"
              className="h-24 sm:h-40 w-auto object-contain max-w-full"
            />
            <img src={calcImg} alt="" className="w-48 sm:w-72 -rotate-12 pointer-events-none" />
          </div>

          {/* Normalized top actions grid (with pinned help) */}
          <div className="w-full sm:w-[26rem]">
            <div className="relative">
              <div className="grid grid-cols-3 gap-2 pr-12">
                <ActionButton onClick={openHub} title={t("returnHub")}>
                  {t("hub")}
                </ActionButton>
                <ActionButton onClick={openPreview}>{t("preview")}</ActionButton>
                <ActionButton onClick={() => setExportMenuOpen(true)}>{t("export")}</ActionButton>
              </div>

              <button
                type="button"
                title={t("help")}
                onClick={() => setHelpOpen(true)}
                className={
                  "print:hidden absolute right-0 top-0 h-10 w-10 rounded-xl border border-neutral-200 bg-white shadow-sm " +
                  "flex items-center justify-center font-bold text-neutral-800 transition " +
                  "hover:bg-[rgb(var(--ts-accent-rgb)/0.30)] hover:border-[var(--ts-accent)]"
                }
                aria-label={t("help")}
              >
                ?
              </button>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <LanguageToggle lang={lang} setLang={setLang} />
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
                <div className="font-semibold text-neutral-800">{t("inputs")}</div>
                <div className="text-xs text-neutral-600">{t("autosaves")}</div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">{t("grossMonthly")}</div>
                  <input
                    className={inputBase}
                    value={data.grossMonthly}
                    onFocus={selectAllOnFocus}
                    onChange={(e) => setData((d) => ({ ...d, grossMonthly: safeNum(e.target.value, 0) }))}
                    type="number"
                    min={0}
                    step="50"
                  />
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">{t("taxClass")}</div>
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
                  <div className="text-neutral-600 font-medium">{t("churchTax")}</div>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!data.churchTax}
                      onChange={(e) => setData((d) => ({ ...d, churchTax: e.target.checked }))}
                      className="h-4 w-4 accent-[var(--ts-accent)]"
                    />
                    <span className="text-sm font-medium text-neutral-800">{t("yes")}</span>
                  </div>
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">{t("childrenAllowance")}</div>
                  <input
                    className={inputBase}
                    value={data.childAllowance}
                    onFocus={selectAllOnFocus}
                    onChange={(e) => setData((d) => ({ ...d, childAllowance: safeNum(e.target.value, 0) }))}
                    type="number"
                    min={0}
                    step="0.5"
                  />
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">{t("state")}</div>
                  <select
                    className={inputBase}
                    value={data.state}
                    onChange={(e) => setData((d) => ({ ...d, state: e.target.value }))}
                  >
                    {STATES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {lang === "de" ? s.de : s.en}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">{t("healthInsurance")}</div>
                  <select
                    className={inputBase}
                    value={data.healthType}
                    onChange={(e) => setData((d) => ({ ...d, healthType: e.target.value }))}
                  >
                    <option value="public">{t("publicGkv")}</option>
                    <option value="private">{t("privatePkv")}</option>
                  </select>
                </label>

                {data.healthType === "private" ? (
                  <label className="block text-sm">
                    <div className="text-neutral-600 font-medium">{t("pkvPremiumMonthly")}</div>
                    <input
                      className={inputBase}
                      value={data.pkvPremiumMonthly ?? 0}
                      onFocus={selectAllOnFocus}
                      onChange={(e) => setData((d) => ({ ...d, pkvPremiumMonthly: safeNum(e.target.value, 0) }))}
                      type="number"
                      min={0}
                      step="10"
                    />
                  </label>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                <div className="font-semibold text-neutral-800">{t("estimateAssumptions")}</div>
                <ul className="mt-2 list-disc pl-5">
                  <li>{t("assump1")}</li>
                  <li>{t("assump2")}</li>
                  <li>{t("assump3")}</li>
                  <li>{t("assump4")}</li>
                </ul>
              </div>

              <div className="mt-3 text-xs text-neutral-600">
                {t("storageKey")} <span className="font-mono">{KEY}</span>
              </div>
            </div>
          </div>

          {/* Output */}
          <div className={card}>
            <div className={cardPad}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-800">{t("output")}</div>
                  <div className="text-sm text-neutral-600">{t("grossToNet")}</div>
                </div>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-sm font-extrabold border border-[var(--ts-accent)] bg-[var(--ts-accent)] text-neutral-800 shadow-sm transition hover:brightness-95 active:translate-y-[1px]"
                  onClick={openPreview}
                >
                  {t("openPreview")}
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-bold tracking-wide text-neutral-600">{t("netEst")}</div>
                <div className="mt-1 text-3xl font-black tabular-nums text-neutral-800">{EUR(breakdown.netMonthly, locale)}</div>
                <div className="mt-1 text-sm text-neutral-600">{t("perMonth")}</div>

                <div className="mt-2 text-xs text-neutral-600">{t("estimateFootnote")}</div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {/* Taxes */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="text-xs font-bold text-neutral-600">{t("taxesMonthly")}</div>
                    <div className="mt-1 text-lg font-black tabular-nums text-neutral-800">{EUR(taxesMonthly, locale)}</div>
                    <div className="mt-2 space-y-1">
                      <StatRow label={t("incomeTax")} value={EUR((breakdown.taxes.incomeTaxAnnual || 0) / 12, locale)} />
                      <StatRow label={t("soli")} value={EUR((breakdown.taxes.soliAnnual || 0) / 12, locale)} />
                      <StatRow label={t("church")} value={EUR((breakdown.taxes.churchAnnual || 0) / 12, locale)} />
                    </div>
                  </div>

                  {/* Social */}
                  <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="text-xs font-bold text-neutral-600">{t("socialMonthly")}</div>
                    <div className="mt-1 text-lg font-black tabular-nums text-neutral-800">{EUR(breakdown.social.total, locale)}</div>
                    <div className="mt-2 space-y-1">
                      <StatRow label={t("pension")} value={EUR(breakdown.social.rv, locale)} />
                      <StatRow label={t("unemployment")} value={EUR(breakdown.social.av, locale)} />
                      <StatRow label={t("health")} value={EUR(breakdown.social.kv, locale)} />
                      <StatRow label={t("care")} value={EUR(breakdown.social.pv, locale)} hint={breakdown.social.note} />
                      {data.healthType === "private" && (breakdown.pkvPremiumMonthly || 0) > 0 ? (
                        <StatRow label={t("pkvPremiumMonthly")} value={EUR(breakdown.pkvPremiumMonthly, locale)} />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-neutral-600">
                  {t("taxableIncomeAnnual")} <span className="font-bold text-neutral-800">{EUR(breakdown.taxableIncomeAnnual, locale)}</span>
                </div>
              </div>

              <div className="mt-4 text-sm text-neutral-700">
                <div className="font-semibold text-neutral-800">{t("quickRead")}</div>
                <ul className="mt-2 list-disc pl-5">
                  <li>
                    {t("grossLine")}: {EUR(breakdown.grossMonthly, locale)} / {t("perMonth")}
                  </li>
                  <li>
                    {t("socialLine")}: {EUR(breakdown.social.total, locale)} / {t("perMonth")}
                  </li>
                  <li>
                    {t("taxesLine")}: {EUR(taxesMonthly, locale)} / {t("perMonth")}
                  </li>
                  <li>
                    {t("netLine")}: <span className="font-bold">{EUR(breakdown.netMonthly, locale)}</span> / {t("perMonth")}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Import micro-state */}
        {importing ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-neutral-800 text-white px-4 py-3 shadow-xl print:hidden">
            <div className="text-sm">{t("importing")}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
