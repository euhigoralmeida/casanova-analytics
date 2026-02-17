/**
 * Export an array of objects as a CSV file (client-side).
 * Includes UTF-8 BOM for Excel compatibility with accented characters.
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
) {
  if (data.length === 0) return;

  const header = columns.map((c) => escapeCsvField(c.label)).join(";");
  const rows = data.map((row) =>
    columns.map((c) => escapeCsvField(String(row[c.key] ?? ""))).join(";"),
  );

  const bom = "\uFEFF";
  const csv = bom + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
