// Tiny CSV writer — quote everything that has commas, quotes, or newlines.

export function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  if (!rows.length) return headers?.join(",") ?? "";
  const cols = headers ?? Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : String(v);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => escape(r[c])).join(","));
  return lines.join("\r\n");
}
