import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';

// Mock supabase — should not be called for super_admin/society_admin paths.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => {
      throw new Error('supabase.from should NOT be called for admin bypass');
    }),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const MODULES = [
  'dashboard', 'flats', 'members', 'tenants', 'committee',
  'income', 'expenses', 'maintenance', 'reports',
  'notices', 'notifications', 'complaints', 'documents',
  'profile', 'family_members', 'bank', 'vendors',
];
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'];

function setAuth(partial: Partial<ReturnType<typeof useAuthStore.getState>>) {
  useAuthStore.setState({
    user: { id: 'u1', email: 'a@b.c' } as any,
    session: { access_token: 't' } as any,
    profile: null,
    roles: [],
    currentSocietyId: 'society-1',
    isLoading: false,
    ...partial,
  });
}

describe('usePermissions().hasPermission — super_admin bypass', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('returns true for every module/action when user is super_admin (global)', () => {
    setAuth({
      roles: [{ id: 'r1', user_id: 'u1', society_id: null, role: 'super_admin' }],
    });
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current.userGroups).toContain('Super Admin');
    for (const m of MODULES) {
      for (const a of ACTIONS) {
        expect(result.current.hasPermission(m, a), `${m}.${a}`).toBe(true);
      }
    }
    // even unknown modules
    expect(result.current.hasPermission('totally_random_module', 'nuke')).toBe(true);
  });

  it('returns true for every module/action for society_admin in current society', () => {
    setAuth({
      roles: [{ id: 'r1', user_id: 'u1', society_id: 'society-1', role: 'society_admin' }],
    });
    const { result } = renderHook(() => usePermissions(), { wrapper });

    expect(result.current.userGroups).toContain('Society Admin');
    for (const m of MODULES) {
      for (const a of ACTIONS) {
        expect(result.current.hasPermission(m, a), `${m}.${a}`).toBe(true);
      }
    }
  });

  it('super_admin bypass does not depend on currentSocietyId', () => {
    setAuth({
      currentSocietyId: null,
      roles: [{ id: 'r1', user_id: 'u1', society_id: null, role: 'super_admin' }],
    });
    const { result } = renderHook(() => usePermissions(), { wrapper });
    expect(result.current.hasPermission('anything', 'view')).toBe(true);
  });
});
