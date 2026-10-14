import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bug, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Map routes → module keys (mirrors AppSidebar)
const ROUTE_MODULE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/flats': 'flats',
  '/members': 'members',
  '/tenants': 'tenants',
  '/committee': 'committee',
  '/income': 'income',
  '/expenses': 'expenses',
  '/approvals': 'expenses',
  '/maintenance': 'maintenance',
  '/bank-reconciliation': 'expenses',
  '/reports': 'reports',
  '/notices': 'notices',
  '/notifications': 'notifications',
  '/complaints': 'complaints',
  '/vendors': 'expenses',
  '/documents': 'documents',
};

export function PermissionsDebugPanel() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, profile, roles, currentSocietyId, isSuperAdmin, isAdmin, getCurrentRole } = useAuthStore();
  const { currentSociety } = useSocietyStore();
  const { permissions, hasPermission, userGroups, isLoading } = usePermissions();

  if (import.meta.env.PROD) return null;

  const isSuper = isSuperAdmin();
  const isAdm = isAdmin();
  const role = getCurrentRole();

  // Current route decision
  const path = '/' + (location.pathname.split('/')[1] || '');
  const module = ROUTE_MODULE[path];
  let decision: { allowed: boolean; reason: string };
  if (isSuper) decision = { allowed: true, reason: 'super_admin bypass (all modules/actions)' };
  else if (isAdm) decision = { allowed: true, reason: 'society_admin bypass in current society' };
  else if (!module) decision = { allowed: true, reason: 'route not mapped to a module (public within app)' };
  else if (isLoading) decision = { allowed: true, reason: 'permissions still loading' };
  else decision = hasPermission(module, 'view')
    ? { allowed: true, reason: `group permission grants view on "${module}"` }
    : { allowed: false, reason: `no group grants view on "${module}"` };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] rounded-full bg-primary text-primary-foreground shadow-lg p-3 hover:opacity-90"
        title="Permissions debug"
        aria-label="Open permissions debug panel"
      >
        <Bug className="h-4 w-4" />
      </button>
    );
  }

  const permList = Object.values(permissions);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[380px] max-h-[70vh] rounded-lg border bg-background shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bug className="h-4 w-4" /> Permissions Debug
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3 text-xs">
          <section>
            <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-1">User</div>
            <div>{profile?.full_name || user?.email || '—'}</div>
            <div className="text-muted-foreground">{user?.email}</div>
          </section>

          <section>
            <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Society</div>
            <div>{currentSociety?.name || '—'}</div>
            <div className="text-muted-foreground break-all">{currentSocietyId || 'none'}</div>
          </section>

          <section>
            <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Roles</div>
            <div className="flex flex-wrap gap-1">
              {roles.length === 0 && <span className="text-muted-foreground">none</span>}
              {roles.map(r => (
                <Badge key={r.id} variant={r.role === 'super_admin' ? 'default' : 'secondary'}>
                  {r.role}{r.society_id ? '' : ' (global)'}
                </Badge>
              ))}
            </div>
            <div className="mt-1 text-muted-foreground">
              current: <span className="font-mono">{role || 'none'}</span> · super:{' '}
              <span className={isSuper ? 'text-primary font-medium' : ''}>{String(isSuper)}</span> · admin:{' '}
              <span className={isAdm ? 'text-primary font-medium' : ''}>{String(isAdm)}</span>
            </div>
          </section>

          <section>
            <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Groups</div>
            <div className="flex flex-wrap gap-1">
              {userGroups.length === 0 && <span className="text-muted-foreground">none</span>}
              {userGroups.map(g => <Badge key={g} variant="outline">{g}</Badge>)}
            </div>
          </section>

          <section>
            <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Current route</div>
            <div className="font-mono">{location.pathname}</div>
            <div className="text-muted-foreground">module: {module || '(unmapped)'}</div>
            <div className={cn(
              'mt-1 rounded px-2 py-1',
              decision.allowed ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
            )}>
              {decision.allowed ? 'ALLOWED' : 'DENIED'} — {decision.reason}
            </div>
          </section>

          <section>
            <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-1">
              Computed permissions {isSuper && '(bypass: all true)'}
            </div>
            {isSuper || isAdm ? (
              <div className="text-muted-foreground">Admin bypass — all modules/actions allowed.</div>
            ) : permList.length === 0 ? (
              <div className="text-muted-foreground">No group permissions</div>
            ) : (
              <table className="w-full">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left">module</th>
                    <th>v</th><th>c</th><th>e</th><th>d</th><th>a</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {permList.map(p => (
                    <tr key={p.module} className="border-t border-border/40">
                      <td className="py-0.5">{p.module}</td>
                      <td className="text-center">{p.can_view ? '✓' : '·'}</td>
                      <td className="text-center">{p.can_create ? '✓' : '·'}</td>
                      <td className="text-center">{p.can_edit ? '✓' : '·'}</td>
                      <td className="text-center">{p.can_delete ? '✓' : '·'}</td>
                      <td className="text-center">{p.can_approve ? '✓' : '·'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
