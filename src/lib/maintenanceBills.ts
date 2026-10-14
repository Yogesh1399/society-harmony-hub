// Pure helpers for maintenance bill generation — extracted so they are unit-testable
// without pulling in React / TanStack Query.

export const RENTED_STATUSES = new Set(['rented', 'available_for_tenant', 'tenant_occupied']);

export interface GenerateInput {
  year: number;
  month: number; // 1-12
  dueDay: number;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  billMonth?: string;   // "YYYY-MM"
  dueDate?: string;     // "YYYY-MM-DD"
}

export function validateGenerateInput(input: GenerateInput, maxYear = new Date().getFullYear() + 1): ValidationResult {
  const { year, month, dueDay } = input;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: 'Bill month must be between 1 and 12' };
  }
  if (!Number.isInteger(year) || year < 2000 || year > maxYear) {
    return { ok: false, error: 'Bill year is out of allowed range' };
  }
  const billMonth = `${year}-${String(month).padStart(2, '0')}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billMonth)) {
    return { ok: false, error: 'Invalid bill month format' };
  }
  const day = Math.min(Math.max(Number(dueDay || 10), 1), 28);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (isNaN(d.getTime())) return { ok: false, error: 'Could not compute a valid due date' };
  return { ok: true, billMonth, dueDate: d.toISOString().split('T')[0] };
}

export interface MaintenanceSettingsLike {
  calculation_basis?: string;
  owner_occupied_amount?: number | string;
  rented_flat_amount?: number | string;
  per_sqft_rate?: number | string;
  due_day?: number | string;
}

export interface MaintenanceHeadLike {
  id: string;
  head_name: string;
  amount: number | string;
  is_active?: boolean;
}

export interface MemberLike {
  id: string;
  full_name?: string;
  maintenance_amount?: number | string;
  extra_maintenance?: number | string;
}

export interface FlatLike {
  id: string;
  flat_number?: string;
  wing?: string | null;
  status?: string;
  area_sqft?: number | string;
  members?: MemberLike[];
}

export function computeFlatAmount(
  flat: FlatLike,
  settings: MaintenanceSettingsLike | null | undefined,
  activeHeads: MaintenanceHeadLike[],
): number {
  const basis = settings?.calculation_basis || 'flat_rate';
  const ownerAmt = Number(settings?.owner_occupied_amount || 0);
  const rentedAmt = Number(settings?.rented_flat_amount || 0);
  const perSqft = Number(settings?.per_sqft_rate || 0);
  const headTotal = activeHeads.reduce((s, h) => s + (Number(h.amount) || 0), 0);

  const member = flat.members?.[0];
  const extra = Number(member?.extra_maintenance || 0);
  const flatTypeAmt = RENTED_STATUSES.has(flat.status || '') ? rentedAmt : ownerAmt;
  const sqftAmt = Number(flat.area_sqft || 0) * perSqft;

  let base = 0;
  switch (basis) {
    case 'flat_type':   base = flatTypeAmt; break;
    case 'per_sqft':    base = sqftAmt; break;
    case 'combo':       base = flatTypeAmt + sqftAmt; break;
    case 'member_wise': base = Number(member?.maintenance_amount || 0); break;
    default:            base = headTotal;
  }
  return Number((base + extra).toFixed(2));
}

export interface BillInsert {
  society_id: string;
  flat_id: string;
  member_id: string | null;
  bill_month: string;
  total_amount: number;
  due_date: string;
  status: 'pending';
}

export function buildBillInserts(
  societyId: string,
  flats: FlatLike[],
  settings: MaintenanceSettingsLike | null | undefined,
  heads: MaintenanceHeadLike[],
  billMonth: string,
  dueDate: string,
): BillInsert[] {
  const activeHeads = heads.filter(h => h.is_active);
  return flats
    .filter(f => f.status !== 'vacant')
    .map(f => ({
      society_id: societyId,
      flat_id: f.id,
      member_id: f.members?.[0]?.id || null,
      bill_month: billMonth,
      total_amount: computeFlatAmount(f, settings, activeHeads),
      due_date: dueDate,
      status: 'pending' as const,
    }))
    .filter(b => b.total_amount > 0 && Number.isFinite(b.total_amount));
}

/** Convert an array of records into a CSV string. */
export function toCSV(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0) return (headers || []).join(',') + '\n';
  const cols = headers ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map(c => esc(r[c])).join(','));
  return lines.join('\n');
}
