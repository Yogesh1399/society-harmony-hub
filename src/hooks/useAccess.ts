import { useAuthStore } from '@/stores/authStore';
import { useCommitteeRole } from '@/hooks/useCommitteeRole';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * The single source of truth for "may this user do this?" in the UI.
 *
 * It deliberately mirrors the two database functions that actually
 * enforce access, so a button never appears for something the database
 * will refuse:
 *
 *   can_write_society()   -> canWriteSociety
 *       super admin, society admin, or any active committee member
 *
 *   can_manage_finance()  -> canManageFinance
 *       super admin, society admin, or an office bearer
 *       (chairman / secretary / treasurer)
 *
 * If you ever change one of those SQL functions, change this hook in the
 * same commit. The database is the real gate; this hook only keeps the
 * screen honest about it.
 */

/** Modules whose rows are money and follow can_manage_finance. */
const FINANCE_MODULES = new Set([
  'income',
  'expenses',
  'maintenance',
  'bank',
  'vendors',
]);

/** Modules only a society admin or super admin may change. */
const ADMIN_ONLY_MODULES = new Set([
  'settings',
  'feature_settings',
  'admin_controller',
  'permissions',
]);

/**
 * What each role may SEE when the society has not configured permission
 * groups yet — which is the normal state for a small society, and the
 * state every new society starts in.
 *
 * This is the one place these defaults are defined. The sidebar and the
 * route gate both read them from here, so a link and the page behind it
 * can never disagree.
 *
 * Note what is NOT here for flat_owner: income and expenses. A member is
 * entitled to the society's accounts, which they get through 'reports'
 * and their own ledger — not through the entry registers, where every
 * voucher carries vendor details and attached evidence.
 */
export const DEFAULT_VIEW: Record<string, string[]> = {
  committee_member: [
    'dashboard', 'flats', 'members', 'tenants', 'committee', 'income', 'expenses',
    'maintenance', 'reports', 'notices', 'notifications', 'complaints', 'documents',
    'vendors', 'bank', 'profile', 'family_members',
  ],
  flat_owner: [
    'dashboard', 'members', 'notices', 'notifications', 'complaints',
    'maintenance', 'reports', 'documents', 'profile', 'family_members',
  ],
  tenant: [
    'notices', 'notifications', 'complaints', 'profile', 'family_members',
  ],
  auditor: [
    'dashboard', 'flats', 'members', 'income', 'expenses', 'maintenance',
    'reports', 'documents', 'profile',
  ],
};

export type AccessAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

export function useAccess() {
  const { isSuperAdmin, getCurrentRole, hasRole } = useAuthStore();
  const { role: committeeRole, isLoading: committeeLoading } = useCommitteeRole();
  const { hasPermission, isLoading: permsLoading, userGroups } = usePermissions();

  const isSuper = isSuperAdmin();
  const isSocietyAdmin = getCurrentRole() === 'society_admin';
  const isFullAccess = isSuper || isSocietyAdmin;

  // Mirrors can_write_society(): any active committee member counts,
  // whether they are recorded in user_roles or in committee_members.
  const canWriteSociety =
    isFullAccess || hasRole('committee_member') || !!committeeRole;

  // Mirrors can_manage_finance(): holding a committee seat is not the
  // same as holding the treasurer's or secretary's portfolio.
  const canManageFinance =
    isFullAccess ||
    committeeRole === 'chairman' ||
    committeeRole === 'secretary' ||
    committeeRole === 'treasurer';

  const isLoading = committeeLoading || permsLoading;

  /**
   * can('income', 'create') — true only if BOTH the database would allow
   * it and the user's permission group (if they have one) allows it.
   *
   * Reading is left to the existing permission groups; writing is gated
   * on role first, because that is what RLS checks.
   */
  const can = (module: string, action: AccessAction): boolean => {
    if (isSuper) return true;

    if (action === 'view') {
      if (ADMIN_ONLY_MODULES.has(module)) return isFullAccess;
      if (isFullAccess) return true;
      // No permission group configured → fall back to the role defaults.
      if (userGroups.length === 0) {
        const role = committeeRole ? 'committee_member' : (getCurrentRole() || 'flat_owner');
        const allowed = DEFAULT_VIEW[role] || DEFAULT_VIEW.flat_owner;
        return allowed.includes(module);
      }
      return hasPermission(module, 'view');
    }

    // Any write, from here down.
    if (ADMIN_ONLY_MODULES.has(module)) return isFullAccess;

    // While the role is still being fetched, withhold write controls.
    // Showing a Delete button for half a second and taking it away is
    // worse than showing it a moment late.
    if (isLoading && !isFullAccess) return false;

    const roleAllows = FINANCE_MODULES.has(module)
      ? canManageFinance
      : canWriteSociety;

    if (!roleAllows) return false;
    if (isFullAccess) return true;

    // A committee member passes the role gate. If the society has gone
    // to the trouble of assigning permission groups, honour them;
    // otherwise the role alone decides.
    if (userGroups.length === 0) return true;
    return hasPermission(module, action);
  };

  return {
    can,
    canWriteSociety,
    canManageFinance,
    isFullAccess,
    isSuper,
    isSocietyAdmin,
    committeeRole,
    isLoading,
  };
}
