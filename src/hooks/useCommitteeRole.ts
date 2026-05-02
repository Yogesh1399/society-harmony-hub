import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export type CommitteeRole = 'chairman' | 'secretary' | 'treasurer' | 'member' | null;

/**
 * Returns the current user's committee role in the active society
 * (chairman/secretary/treasurer/member or null).
 */
export function useCommitteeRole() {
  const { user, currentSocietyId, isSuperAdmin } = useAuthStore();
  const isSuper = isSuperAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ['committee-role', user?.id, currentSocietyId],
    queryFn: async () => {
      if (!user?.id || !currentSocietyId) return null;
      const { data, error } = await supabase.rpc('get_committee_role', {
        _user_id: user.id,
        _society_id: currentSocietyId,
      });
      if (error) {
        console.error('get_committee_role error', error);
        return null;
      }
      return (data as CommitteeRole) ?? null;
    },
    enabled: !!user?.id && !!currentSocietyId,
    staleTime: 5 * 60 * 1000,
  });

  const role = data ?? null;
  return {
    role,
    isLoading,
    isChairman: role === 'chairman' || isSuper,
    isSecretary: role === 'secretary' || isSuper,
    isTreasurer: role === 'treasurer' || isSuper,
    isCommittee: !!role || isSuper,
  };
}
