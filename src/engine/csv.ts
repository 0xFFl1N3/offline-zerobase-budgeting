/** Splits CSV text into rows of cells. Handles quotes, doubled quotes, line breaks inside quotes and a byte-order mark. */
export function parseCsv(text: string, separator = detectSeparator(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (ch === separator) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  // Blank lines carry no data.
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** The separator that splits the most lines into the same number of cells: ";" (German banks), "," or tab. */
export function detectSeparator(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 50);
  let best = ',';
  let bestScore = -1;
  for (const sep of [';', ',', '\t']) {
    const counts = lines.map((l) => countOutsideQuotes(l, sep)).filter((c) => c > 0);
    if (counts.length === 0) continue;
    // The most common count, weighted by how many lines share it and how many columns it gives.
    const freq = new Map<number, number>();
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
    const score = Math.max(...[...freq].map(([c, f]) => f * 1000 + c));
    if (score > bestScore) {
      bestScore = score;
      best = sep;
    }
  }
  return best;
}

function countOutsideQuotes(line: string, sep: string): number {
  let quoted = false;
  let count = 0;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) count++;
  }
  return count;
}
