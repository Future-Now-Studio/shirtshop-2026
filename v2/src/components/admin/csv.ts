// CSV helpers for admin exports/imports. Exports are meant for German Excel
// (";" separator, comma decimals, UTF-8 BOM).

type Cell = string | number | boolean | null | undefined;

/**
 * One quoted CSV field. Text starting with = + - @ tab or CR is prefixed with
 * an apostrophe so spreadsheets never run it as a formula (values such as
 * e-mail addresses can come from anonymous visitors).
 */
export function csvCell(v: Cell): string {
  if (typeof v === "number") return String(v);
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** 19.9 → "19,90" (German decimal comma). */
export function decimalDe(v: number | string | null | undefined): string {
  return Number(v ?? 0).toFixed(2).replace(".", ",");
}

export function downloadCsv(filename: string, rows: Cell[][], sep = ";") {
  const text = rows.map((r) => r.map(csvCell).join(sep)).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Parses CSV text into header-keyed rows. Detects ";" or "," from the header
 * line, handles quoted fields (incl. "" and line breaks) and undoes the
 * formula apostrophe added by csvCell. Header names are trimmed + lower-cased.
 */
export function parseCsv(text: string): { header: string[]; rows: Record<string, string>[]; sep: string } {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      records.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); records.push(row); }

  const clean = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v).trim();
  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return { header: [], rows: [], sep };
  const header = nonEmpty[0].map((h) => clean(h).toLowerCase());
  const rows = nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, clean(r[i] ?? "")])));
  return { header, rows, sep };
}

/** "12,50" / "12.50" / "1.234,50" → number; NaN when not a number. */
export function parseDecimal(raw: string): number {
  let s = raw.replace(/\s|€/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
