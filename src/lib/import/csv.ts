// Minimal RFC 4180 CSV parser: quoted fields, "" escapes, embedded commas/newlines, CRLF or LF.
// The first row is the header; returns one object per data row keyed by header name.

export class CsvParseError extends Error {}

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text.replace(/^﻿/, ''));
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const seen = new Set<string>();
  for (const h of header) {
    if (!h) throw new CsvParseError('CSV header contains an empty column name');
    if (seen.has(h)) throw new CsvParseError(`CSV header repeats column "${h}"`);
    seen.add(h);
  }

  return rows.slice(1).map((cells, i) => {
    if (cells.length !== header.length) {
      throw new CsvParseError(`CSV record ${i + 1} has ${cells.length} fields, expected ${header.length}`);
    }
    return Object.fromEntries(header.map((h, j) => [h, cells[j]]));
  });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (c === '"') {
        quoted = false;
        i++;
      } else {
        field += c;
        i++;
      }
      continue;
    }
    if (c === '"' && field === '') {
      quoted = true;
      i++;
    } else if (c === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (c === '\n' || c === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      field += c;
      i++;
    }
  }
  if (quoted) throw new CsvParseError('CSV ends inside a quoted field');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines (a single empty field) are not records.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}
