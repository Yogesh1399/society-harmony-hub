import { describe, it, expect } from 'vitest';
import {
  validateGenerateInput,
  computeFlatAmount,
  buildBillInserts,
  toCSV,
} from './maintenanceBills';

describe('validateGenerateInput', () => {
  it('accepts valid month/year and formats billMonth + dueDate', () => {
    const r = validateGenerateInput({ year: 2026, month: 3, dueDay: 10 });
    expect(r.ok).toBe(true);
    expect(r.billMonth).toBe('2026-03');
    expect(r.dueDate).toBe('2026-03-10');
  });

  it('rejects month out of range', () => {
    expect(validateGenerateInput({ year: 2026, month: 0, dueDay: 10 }).ok).toBe(false);
    expect(validateGenerateInput({ year: 2026, month: 13, dueDay: 10 }).ok).toBe(false);
  });

  it('rejects year outside allowed window', () => {
    expect(validateGenerateInput({ year: 1900, month: 1, dueDay: 10 }).ok).toBe(false);
    expect(validateGenerateInput({ year: 3000, month: 1, dueDay: 10 }, 2027).ok).toBe(false);
  });

  it('clamps due day to [1,28] and defaults falsy values', () => {
    expect(validateGenerateInput({ year: 2026, month: 2, dueDay: 31 }).dueDate).toBe('2026-02-28');
    // 0 is falsy → falls back to default 10
    expect(validateGenerateInput({ year: 2026, month: 2, dueDay: 0 }).dueDate).toBe('2026-02-10');
  });
});

describe('computeFlatAmount', () => {
  const heads = [
    { id: 'h1', head_name: 'Sinking', amount: 500, is_active: true },
    { id: 'h2', head_name: 'Water', amount: 300, is_active: true },
  ];

  it('sums active heads for flat_rate basis', () => {
    const amt = computeFlatAmount(
      { id: 'f1', status: 'owner_occupied' },
      { calculation_basis: 'flat_rate' },
      heads,
    );
    expect(amt).toBe(800);
  });

  it('adds extra_maintenance from member', () => {
    const amt = computeFlatAmount(
      { id: 'f1', status: 'owner_occupied', members: [{ id: 'm1', extra_maintenance: 150 }] },
      { calculation_basis: 'flat_rate' },
      heads,
    );
    expect(amt).toBe(950);
  });

  it('uses rented amount for rented status in flat_type basis', () => {
    const s = { calculation_basis: 'flat_type', owner_occupied_amount: 1000, rented_flat_amount: 1500 };
    expect(computeFlatAmount({ id: 'f1', status: 'rented' }, s, [])).toBe(1500);
    expect(computeFlatAmount({ id: 'f1', status: 'owner_occupied' }, s, [])).toBe(1000);
  });

  it('per_sqft = area * rate', () => {
    const amt = computeFlatAmount(
      { id: 'f1', status: 'owner_occupied', area_sqft: 800 },
      { calculation_basis: 'per_sqft', per_sqft_rate: 2.5 },
      [],
    );
    expect(amt).toBe(2000);
  });

  it('member_wise uses member.maintenance_amount', () => {
    const amt = computeFlatAmount(
      { id: 'f1', status: 'owner_occupied', members: [{ id: 'm1', maintenance_amount: 2222 }] },
      { calculation_basis: 'member_wise' },
      [],
    );
    expect(amt).toBe(2222);
  });
});

describe('buildBillInserts', () => {
  const flats = [
    { id: 'f1', status: 'owner_occupied', members: [{ id: 'm1' }] },
    { id: 'f2', status: 'vacant', members: [{ id: 'm2' }] },
    { id: 'f3', status: 'rented', members: [] },
  ];

  it('skips vacant flats and zero-amount rows', () => {
    const rows = buildBillInserts(
      'soc-1',
      flats,
      { calculation_basis: 'flat_rate' },
      [{ id: 'h', head_name: 'M', amount: 100, is_active: true }],
      '2026-04',
      '2026-04-10',
    );
    expect(rows.map(r => r.flat_id)).toEqual(['f1', 'f3']);
    expect(rows[0]).toMatchObject({
      society_id: 'soc-1', member_id: 'm1', bill_month: '2026-04',
      due_date: '2026-04-10', status: 'pending', total_amount: 100,
    });
    expect(rows[1].member_id).toBeNull();
  });

  it('filters out flats that compute to zero', () => {
    const rows = buildBillInserts(
      'soc-1',
      [{ id: 'f1', status: 'owner_occupied' }],
      { calculation_basis: 'flat_rate' },
      [], // no active heads => 0
      '2026-04', '2026-04-10',
    );
    expect(rows).toEqual([]);
  });
});

describe('toCSV', () => {
  it('serialises rows and escapes quotes/commas/newlines', () => {
    const csv = toCSV(
      [{ a: 1, b: 'hi, "you"', c: 'multi\nline' }],
      ['a', 'b', 'c'],
    );
    expect(csv.split('\n')[0]).toBe('a,b,c');
    expect(csv).toContain('"hi, ""you"""');
    expect(csv).toContain('"multi\nline"');
  });

  it('returns just headers when rows are empty', () => {
    expect(toCSV([], ['x', 'y'])).toBe('x,y\n');
  });
});
