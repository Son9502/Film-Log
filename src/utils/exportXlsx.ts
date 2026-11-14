// ── Spreadsheet export (.xlsx) ───────────────────────────────────────────────
// One workbook: a "Rolls" sheet with one row per roll, an "All frames" sheet, and
// one sheet per roll with its frames. Each roll name links to its sheet, and each
// roll sheet links back. Written by hand (an .xlsx is zipped XML) with fflate, so
// no spreadsheet library is needed.
import { strToU8, zipSync } from "fflate";
import type { Roll, Shot } from "@/types";
import { scanArchivePath } from "./scanPaths";

type Names = { film: (id: string) => string; camera: (id: string) => string };
type Value = string | number | boolean | null | undefined;

/** A cell that links to another sheet. */
interface Link { text: string; sheet: string }
type Cell = Value | Link;

interface Sheet {
  name: string;
  rows: Cell[][];
  /** Rows above the table that stay visible while scrolling (title, links, header). */
  frozenRows: number;
  /** 0-based index of the header row, shown bold. */
  headerRow: number;
  widths?: number[];
}

// ── Columns ──────────────────────────────────────────────────────────────────

const ROLL_HEADER = [
  "Roll", "Film", "Camera", "ISO", "Frames", "Frames logged", "Status", "Loaded", "Developed",
  "Location", "Developer", "Dilution", "Dev time", "Dev temp", "Push/pull", "Fixer",
  "Film expires", "Extra exposure for age (stops)", "Notes", "Roll ID",
];

const FRAME_HEADER = [
  "Frame", "Shot at", "Shutter", "Aperture", "Lighting", "Subject", "Location", "Latitude",
  "Longitude", "Flash", "Filter", "Weather", "Rating", "Tags", "Notes", "Scan file",
];

const rollTitle = (r: Roll, names: Names) => r.name?.trim() || names.film(r.filmStockId);

function rollCells(r: Roll, names: Names, title: Cell): Cell[] {
  return [
    title, names.film(r.filmStockId), names.camera(r.cameraId), num(r.iso), r.frameCount,
    r.shots.length, r.status, r.loadedAt, r.developedAt, r.locationLabel, r.developer, r.dilution,
    r.devTime, r.devTemp, r.pushPull, r.fixer, r.expiresAt, r.expiryCompStops, r.notes, r.id,
  ];
}

function frameCells(r: Roll, s: Shot): Cell[] {
  return [
    s.frame, s.timestamp, s.shutter, s.aperture, s.lighting, s.subject, s.locationLabel ?? r.locationLabel,
    s.location?.latitude, s.location?.longitude, s.flash ? "yes" : "", s.filter, s.weather,
    s.rating, s.tags?.join("; "), s.notes, scanArchivePath(r, s),
  ];
}

/** Label/value rows for the top of a roll's sheet; empty values are left out. */
function rollDetails(r: Roll, names: Names): Cell[][] {
  const scans = r.shots.filter((s) => s.scanUri).length;
  const pairs: [string, Value][] = [
    ["Film", names.film(r.filmStockId)],
    ["Camera", names.camera(r.cameraId)],
    ["ISO", num(r.iso)],
    ["Status", r.status],
    ["Frames", `${r.shots.length} logged of ${r.frameCount}${scans ? ` · ${scans} scanned` : ""}`],
    ["Loaded", r.loadedAt],
    ["Developed", r.developedAt],
    ["Location", r.locationLabel],
    ["Developer", r.developer],
    ["Dilution", r.dilution],
    ["Dev time", r.devTime],
    ["Dev temp", r.devTemp],
    ["Push/pull", r.pushPull],
    ["Fixer", r.fixer],
    ["Film expires", r.expiresAt],
    ["Extra exposure for age (stops)", r.expiryCompStops],
    ["Notes", r.notes],
  ];
  return pairs.filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, v]);
}

/** "400" → 400 so the spreadsheet can sort it; anything else stays text. */
const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);

// ── Sheet names ──────────────────────────────────────────────────────────────

const RESERVED = new Set(["rolls", "all frames", "history"]);

/** Excel sheet names: ≤ 31 characters, none of : \ / ? * [ ], unique (case-insensitive). */
export function sheetName(wanted: string, used: Set<string>): string {
  const base = wanted.replace(/[:\\/?*[\]]/g, "-").replace(/^'+|'+$/g, "").trim() || "Roll";
  for (let i = 1; ; i++) {
    const suffix = i === 1 ? "" : ` (${i})`;
    const name = base.slice(0, 31 - suffix.length).trimEnd() + suffix;
    const key = name.toLowerCase();
    if (!used.has(key) && !RESERVED.has(key)) {
      used.add(key);
      return name;
    }
  }
}

// ── Workbook ─────────────────────────────────────────────────────────────────

export function buildWorkbookSheets(rolls: Roll[], names: Names): Sheet[] {
  const used = new Set<string>();
  const sheetFor = new Map(rolls.map((r) => [r.id, sheetName(`${rollTitle(r, names)} ${r.loadedAt?.slice(0, 10) ?? ""}`.trim(), used)]));
  const link = (r: Roll): Link => ({ text: rollTitle(r, names), sheet: sheetFor.get(r.id)! });

  const summary: Sheet = {
    name: "Rolls", frozenRows: 1, headerRow: 0,
    widths: [28, 22, 18, 6, 7, 8, 13, 11, 11, 18, 16, 9, 9, 9, 9, 16, 11, 12, 30, 14],
    rows: [ROLL_HEADER, ...rolls.map((r) => rollCells(r, names, link(r)))],
  };

  const allFrames: Sheet = {
    name: "All frames", frozenRows: 1, headerRow: 0,
    widths: [28, 22, 18, 7, 17, 9, 9, 12, 20, 18, 11, 11, 6, 10, 10, 6, 18, 30, 28],
    rows: [
      ["Roll", "Film", "Camera", ...FRAME_HEADER],
      ...rolls.flatMap((r) =>
        [...r.shots].sort((a, b) => a.frame - b.frame)
          .map((s) => [link(r), names.film(r.filmStockId), names.camera(r.cameraId), ...frameCells(r, s)])),
    ],
  };

  const perRoll: Sheet[] = rolls.map((r) => {
    const top: Cell[][] = [
      [{ text: "← All rolls", sheet: "Rolls" }],
      [rollTitle(r, names)],
      ...rollDetails(r, names),
      [],
    ];
    const frames = [...r.shots].sort((a, b) => a.frame - b.frame).map((s) => frameCells(r, s));
    return {
      name: sheetFor.get(r.id)!,
      frozenRows: 2, headerRow: top.length,
      widths: [30, 17, 9, 9, 12, 20, 18, 11, 11, 6, 10, 10, 6, 18, 30, 28],
      rows: [
        ...top,
        FRAME_HEADER,
        ...(frames.length ? frames : [["No frames logged yet."]]),
      ],
    };
  });

  return [summary, allFrames, ...perRoll];
}

// ── XML ──────────────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function columnLetter(index: number): string {
  let n = index + 1, out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const isLink = (c: Cell): c is Link => typeof c === "object" && c !== null;
const sheetRef = (name: string) => `'${name.replace(/'/g, "''")}'!A1`;

const STYLE = { normal: 0, bold: 1, link: 2 };

function sheetXml(sheet: Sheet): string {
  const links: string[] = [];
  const rows = sheet.rows.map((row, ri) => {
    const cells = row.map((cell, ci) => {
      const ref = `${columnLetter(ci)}${ri + 1}`;
      if (cell === undefined || cell === null || cell === "") return "";
      if (isLink(cell)) {
        links.push(`<hyperlink ref="${ref}" location="${esc(sheetRef(cell.sheet))}" display="${esc(cell.text)}"/>`);
        return `<c r="${ref}" t="inlineStr" s="${STYLE.link}"><is><t xml:space="preserve">${esc(cell.text)}</t></is></c>`;
      }
      const style = ri === sheet.headerRow ? ` s="${STYLE.bold}"` : "";
      if (typeof cell === "number" && Number.isFinite(cell)) return `<c r="${ref}"${style}><v>${cell}</v></c>`;
      const text = typeof cell === "boolean" ? (cell ? "yes" : "no") : String(cell);
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
    }).join("");
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join("");

  const pane = sheet.frozenRows > 0
    ? `<pane ySplit="${sheet.frozenRows}" topLeftCell="A${sheet.frozenRows + 1}" activePane="bottomLeft" state="frozen"/>`
    : "";
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>`
    + cols
    + `<sheetData>${rows}</sheetData>`
    + (links.length ? `<hyperlinks>${links.join("")}</hyperlinks>` : "")
    + `</worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + `<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>`
  + `<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>`
  + `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>`
  + `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>`
  + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
  + `<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
  + `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
  + `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>`
  + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>`
  + `</styleSheet>`;

export function buildXlsx(rolls: Roll[], names: Names): Uint8Array {
  const sheets = buildWorkbookSheets(rolls, names);
  const files: Record<string, Uint8Array> = {};
  const put = (path: string, xml: string) => { files[path] = strToU8(xml); };

  put("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
    + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
    + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
    + `</Types>`);

  put("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
    + `</Relationships>`);

  put("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>`
    + `</workbook>`);

  put("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")
    + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + `</Relationships>`);

  put("xl/styles.xml", STYLES);
  sheets.forEach((s, i) => put(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zipSync(files, { level: 6 });
}
