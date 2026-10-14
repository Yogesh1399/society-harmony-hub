import * as XLSX from 'xlsx';

export interface ExportSheet {
  name: string;
  rows: Record<string, any>[];
  columns?: string[]; // ordered column keys; if omitted, derived from first row
}

/**
 * Export one or more sheets to a single .xlsx file and trigger a browser download.
 */
export function exportToExcel(filename: string, sheets: ExportSheet | ExportSheet[]): void {
  const sheetList = Array.isArray(sheets) ? sheets : [sheets];
  if (sheetList.length === 0 || sheetList.every(s => s.rows.length === 0)) {
    // Still create an empty file rather than throwing.
  }

  const wb = XLSX.utils.book_new();

  sheetList.forEach((sheet) => {
    const cols = sheet.columns ?? (sheet.rows[0] ? Object.keys(sheet.rows[0]) : []);
    const data = sheet.rows.map(row => {
      const ordered: Record<string, any> = {};
      cols.forEach(c => { ordered[c] = row[c] ?? ''; });
      return ordered;
    });

    const ws = XLSX.utils.json_to_sheet(data, { header: cols });

    // Auto-size columns based on header + max value length (capped).
    const colWidths = cols.map(c => {
      const headerLen = c.length;
      const maxValLen = data.reduce((max, r) => {
        const s = String(r[c] ?? '');
        return Math.max(max, s.length);
      }, 0);
      return { wch: Math.min(Math.max(headerLen, maxValLen) + 2, 50) };
    });
    ws['!cols'] = colWidths;

    const safeName = sheet.name.replace(/[\\/?*[\]]/g, '').slice(0, 31) || 'Sheet';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  const finalName = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, finalName);
}

/**
 * Generate a downloadable Excel template with given headers + optional sample row.
 */
export function downloadTemplate(filename: string, headers: string[], sampleRow?: Record<string, any>): void {
  const rows = sampleRow ? [sampleRow] : [];
  exportToExcel(filename, { name: 'Template', rows, columns: headers });
}

/**
 * Read an uploaded Excel/CSV file and return rows as JSON. First sheet only.
 */
export async function parseExcelFile<T = Record<string, any>>(file: File): Promise<T[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<T>(ws, { defval: '' });
}

export const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
