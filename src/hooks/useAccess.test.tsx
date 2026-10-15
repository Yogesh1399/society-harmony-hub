import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAccess } from '@/hooks/useAccess';
import { useAuthStore } from '@/stores/authStore';

/**
 * These tests exist because of a real regression: a flat member logged in
 * and saw every screen and every button an administrator sees. The point
 * of useAccess is that the screen agrees with the database, so the cases
 * below are written from the database's point of view —
 * can_write_society() and can_manage_finance().
 */

// committee_members lookup goes through this RPC.
let committeeRoleForTest: string | null = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: committeeRoleForTest, error: null })),
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    })),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

function setAuth(role: string, societyId: string | null = 'society-1') {
  useAuthStore.setState({
    user: { id: 'u1', email: 'a@b.c' } as any,
    session: { access_token: 't' } as any,
    profile: null,
    roles: [{ id: 'r1', user_id: 'u1', society_id: societyId, role: role as any }],
    currentSocietyId: 'society-1',
    isLoading: false,
  });
}

async function access() {
  const { result } = renderHook(() => useAccess(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe('useAccess — mirrors the database', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    committeeRoleForTest = null;
  });

  it('a flat owner cannot write anything, anywhere', async () => {
    setAuth('flat_owner');
    const r = await access();

    expect(r.current.canWriteSociety).toBe(false);
    expect(r.current.canManageFinance).toBe(false);

    for (const m of ['members', 'flats', 'income', 'expenses', 'maintenance', 'notices']) {
      for (const a of ['create', 'edit', 'delete'] as const) {
        expect(r.current.can(m, a), `flat_owner must not ${a} ${m}`).toBe(false);
      }
    }
  });

  it('a flat owner still sees their own society information', async () => {
    setAuth('flat_owner');
    const r = await access();

    expect(r.current.can('dashboard', 'view')).toBe(true);
    expect(r.current.can('notices', 'view')).toBe(true);
    expect(r.current.can('complaints', 'view')).toBe(true);
    expect(r.current.can('maintenance', 'view')).toBe(true);
    expect(r.current.can('reports', 'view')).toBe(true);
  });

  it('a flat owner cannot open the finance registers or settings', async () => {
    setAuth('flat_owner');
    const r = await access();

    expect(r.current.can('income', 'view')).toBe(false);
    expect(r.current.can('expenses', 'view')).toBe(false);
    expect(r.current.can('settings', 'view')).toBe(false);
    expect(r.current.can('admin_controller', 'view')).toBe(false);
  });

  it('a tenant sees only communication, and writes nothing', async () => {
    setAuth('tenant');
    const r = await access();

    expect(r.current.can('notices', 'view')).toBe(true);
    expect(r.current.can('members', 'view')).toBe(false);
    expect(r.current.can('income', 'view')).toBe(false);
    expect(r.current.can('members', 'edit')).toBe(false);
  });

  it('a plain committee member may keep records but not touch money', async () => {
    setAuth('flat_owner');
    committeeRoleForTest = 'member';
    const r = await access();

    expect(r.current.canWriteSociety).toBe(true);
    expect(r.current.canManageFinance).toBe(false);

    expect(r.current.can('members', 'edit')).toBe(true);
    expect(r.current.can('notices', 'create')).toBe(true);
    expect(r.current.can('income', 'create')).toBe(false);
    expect(r.current.can('expenses', 'create')).toBe(false);
  });

  it('a treasurer may do both', async () => {
    setAuth('flat_owner');
    committeeRoleForTest = 'treasurer';
    const r = await access();

    expect(r.current.canWriteSociety).toBe(true);
    expect(r.current.canManageFinance).toBe(true);
    expect(r.current.can('income', 'create')).toBe(true);
    expect(r.current.can('expenses', 'delete')).toBe(true);
  });

  it.each(['chairman', 'secretary', 'treasurer'])(
    'an office bearer recorded only in committee_members (%s) is an office bearer',
    async (seat) => {
      // This is the live society's shape: committee_members rows exist,
      // user_roles has no committee_member row at all.
      setAuth('flat_owner');
      committeeRoleForTest = seat;
      const r = await access();

      expect(r.current.canWriteSociety).toBe(true);
      expect(r.current.canManageFinance).toBe(true);
    },
  );

  it('only administration may change society configuration', async () => {
    setAuth('flat_owner');
    committeeRoleForTest = 'chairman';
    const r = await access();
    expect(r.current.can('settings', 'edit')).toBe(false);

    useAuthStore.getState().reset();
    committeeRoleForTest = null;
    setAuth('society_admin');
    const admin = await access();
    expect(admin.current.can('settings', 'edit')).toBe(true);
  });

  it('a society admin may do everything in their society', async () => {
    setAuth('society_admin');
    const r = await access();

    for (const m of ['members', 'income', 'expenses', 'notices', 'maintenance']) {
      for (const a of ['view', 'create', 'edit', 'delete', 'approve'] as const) {
        expect(r.current.can(m, a), `society_admin ${a} ${m}`).toBe(true);
      }
    }
  });

  it('a super admin is never blocked', async () => {
    setAuth('super_admin', null);
    const r = await access();
    expect(r.current.can('anything_at_all', 'delete')).toBe(true);
    expect(r.current.can('settings', 'edit')).toBe(true);
  });
});
