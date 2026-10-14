import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuthStore, AppRole } from '@/stores/authStore';

const ROUTES: { path: string; allowed?: AppRole[] }[] = [
  { path: '/dashboard' },
  { path: '/flats', allowed: ['society_admin', 'committee_member'] },
  { path: '/members', allowed: ['society_admin', 'committee_member'] },
  { path: '/tenants', allowed: ['society_admin', 'committee_member'] },
  { path: '/committee', allowed: ['society_admin'] },
  { path: '/income', allowed: ['society_admin', 'committee_member'] },
  { path: '/expenses', allowed: ['society_admin', 'committee_member'] },
  { path: '/approvals', allowed: ['society_admin'] },
  { path: '/maintenance', allowed: ['society_admin', 'committee_member'] },
  { path: '/bank-reconciliation', allowed: ['society_admin'] },
  { path: '/reports', allowed: ['society_admin', 'committee_member'] },
  { path: '/notices', allowed: ['society_admin', 'committee_member'] },
  { path: '/notifications' },
  { path: '/complaints' },
  { path: '/vendors', allowed: ['society_admin'] },
  { path: '/documents', allowed: ['society_admin', 'committee_member'] },
  { path: '/admin-controller', allowed: ['society_admin'] },
  { path: '/settings', allowed: ['society_admin'] },
  { path: '/super-admin', allowed: ['super_admin'] },
  { path: '/super-admin/societies', allowed: ['super_admin'] },
  { path: '/super-admin/users', allowed: ['super_admin'] },
  { path: '/super-admin/support', allowed: ['super_admin'] },
];

function renderAt(path: string, allowed?: AppRole[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path={path}
          element={
            <ProtectedRoute allowedRoles={allowed}>
              <div data-testid="page">OK:{path}</div>
            </ProtectedRoute>
          }
        />
        <Route path="/unauthorized" element={<div data-testid="denied">DENIED</div>} />
        <Route path="/login" element={<div data-testid="login">LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute — super_admin can access every protected route', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAuthStore.setState({
      user: { id: 'u1', email: 'admin@society.com' } as any,
      session: { access_token: 't', user: { id: 'u1' } } as any,
      profile: null,
      roles: [{ id: 'r1', user_id: 'u1', society_id: null, role: 'super_admin' }],
      currentSocietyId: 'society-1',
      isLoading: false,
    });
  });

  it.each(ROUTES)('grants super_admin access to $path', ({ path, allowed }) => {
    renderAt(path, allowed);
    expect(screen.getByTestId('page')).toHaveTextContent(`OK:${path}`);
    expect(screen.queryByTestId('denied')).toBeNull();
    expect(screen.queryByTestId('login')).toBeNull();
  });

  it('denies a plain flat_owner from society_admin-only routes', () => {
    useAuthStore.setState({
      roles: [{ id: 'r2', user_id: 'u1', society_id: 'society-1', role: 'flat_owner' }],
    });
    renderAt('/settings', ['society_admin']);
    expect(screen.getByTestId('denied')).toBeTruthy();
  });

  it('redirects unauthenticated users to /login', () => {
    useAuthStore.setState({ session: null, roles: [] });
    renderAt('/dashboard');
    expect(screen.getByTestId('login')).toBeTruthy();
  });
});
