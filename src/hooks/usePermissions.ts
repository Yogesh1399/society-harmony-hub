import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export interface EffectivePermission {
  module: string;
  can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; can_approve: boolean;
}

export function usePermissions() {
  const { user, currentSocietyId, isSuperAdmin, getCurrentRole } = useAuthStore();
  const isSuper = isSuperAdmin();
  const currentRole = getCurrentRole();
  const isSocietyAdmin = currentRole === 'society_admin';

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['user-group-assignments', user?.id, currentSocietyId],
    queryFn: async () => {
      if (!user?.id || !currentSocietyId) return [];
      const { data, error } = await supabase
        .from('user_group_assignments')
        .select(`
          id, user_id, group_id, society_id,
          additional_permissions, restricted_permissions,
          permission_groups(name),
          group_permissions:group_permissions(module, can_view, can_create, can_edit, can_delete, can_approve)
        `)
        .eq('user_id', user.id)
        .eq('society_id', currentSocietyId);
      if (error) { console.error('usePermissions error:', error); return []; }
      return data || [];
    },
    enabled: !!user?.id && !!currentSocietyId && !isSuper && !isSocietyAdmin,
    staleTime: 2 * 60 * 1000,
  });

  // Super admin & society admin: ALL permissions
  if (isSuper || isSocietyAdmin) {
    return {
      permissions: {} as Record<string, EffectivePermission>,
      hasPermission: (_module: string, _action: string) => true,
      isLoading: false,
      userGroups: isSuper ? ['Super Admin'] : ['Society Admin'],
    };
  }

  const effectivePermissions: Record<string, EffectivePermission> = {};

  if (assignments) {
    for (const assignment of assignments) {
      const groupPerms = (assignment as any).group_permissions || [];
      const additional = (assignment.additional_permissions as any[]) || [];
      const restricted = (assignment.restricted_permissions as any[]) || [];

      for (const perm of groupPerms) {
        if (!effectivePermissions[perm.module]) {
          effectivePermissions[perm.module] = {
            module: perm.module,
            can_view: false, can_create: false, can_edit: false, can_delete: false, can_approve: false,
          };
        }
        const ep = effectivePermissions[perm.module];
        ep.can_view = ep.can_view || !!perm.can_view;
        ep.can_create = ep.can_create || !!perm.can_create;
        ep.can_edit = ep.can_edit || !!perm.can_edit;
        ep.can_delete = ep.can_delete || !!perm.can_delete;
        ep.can_approve = ep.can_approve || !!perm.can_approve;
      }

      for (const add of additional) {
        if (add?.module) {
          if (!effectivePermissions[add.module]) {
            effectivePermissions[add.module] = { module: add.module, can_view: false, can_create: false, can_edit: false, can_delete: false, can_approve: false };
          }
          if (add.action) (effectivePermissions[add.module] as any)[`can_${add.action}`] = true;
        }
      }

      for (const res of restricted) {
        if (res?.module && effectivePermissions[res.module] && res.action) {
          (effectivePermissions[res.module] as any)[`can_${res.action}`] = false;
        }
      }
    }
  }

  const hasPermission = (module: string, action: string): boolean => {
    if (isLoading) return true; // show items while loading
    const perm = effectivePermissions[module];
    if (!perm) return false;
    return (perm as any)[`can_${action}`] ?? false;
  };

  const userGroups = assignments?.map((a: any) => a.permission_groups?.name).filter(Boolean) || [];

  return { permissions: effectivePermissions, hasPermission, isLoading, userGroups };
}
