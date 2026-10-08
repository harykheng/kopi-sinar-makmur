function escapeCsvField(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// No library, this is a plain enough format that hand-rolling it avoids a
// dependency. Leading BOM (U+FEFF) is so Excel opens it as UTF-8 instead of
// guessing wrong and mangling "Rp"/accented characters.
export function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Hand-rolled RFC4180-ish parser (quoted fields, embedded commas/newlines,
// "" escaped quotes) \u2014 no library, mirrors downloadCsv() being hand-rolled
// on the way out. Returns rows as arrays of raw string cells.
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += char; i++; continue;
    }

    if (char === '"') { inQuotes = true; i++; continue; }
    if (char === ',') { row.push(field); field = ''; i++; continue; }
    if (char === '\r') { i++; continue; }
    if (char === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue; }
    field += char; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

// Parses CSV text into objects keyed by the header row \u2014 order-independent,
// unlike parseCsv()'s raw arrays. Used by importers that map columns by name.
export function parseCsvObjects(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] ?? '').trim(); });
    return obj;
  });
}
