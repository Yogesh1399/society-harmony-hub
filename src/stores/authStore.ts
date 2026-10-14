import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'super_admin' | 'society_admin' | 'committee_member' | 'flat_owner' | 'tenant' | 'auditor';

export interface UserRole {
  id: string;
  user_id: string;
  society_id: string | null;
  role: AppRole;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  mobile: string | null;
  profile_photo_url: string | null;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  currentSocietyId: string | null;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setRoles: (roles: UserRole[]) => void;
  setCurrentSocietyId: (societyId: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
  
  // Computed
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  getCurrentRole: () => AppRole | null;
  hasRole: (role: AppRole) => boolean;
  canAccessSociety: (societyId: string) => boolean;
}

const initialState = {
  user: null,
  session: null,
  profile: null,
  roles: [],
  currentSocietyId: null,
  isLoading: true,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setRoles: (roles) => set({ roles }),
      setCurrentSocietyId: (societyId) => set({ currentSocietyId: societyId }),
      setLoading: (loading) => set({ isLoading: loading }),
      
      reset: () => set(initialState),
      
      isSuperAdmin: () => {
        const { roles } = get();
        return roles.some(r => r.role === 'super_admin' && r.society_id === null);
      },

      isAdmin: () => {
        const { roles, currentSocietyId } = get();
        if (roles.some(r => r.role === 'super_admin' && r.society_id === null)) return true;
        return roles.some(r => r.role === 'society_admin' && (r.society_id === currentSocietyId || r.society_id === null));
      },


      
      getCurrentRole: () => {
        const { roles, currentSocietyId } = get();
        
        // Check for super admin first
        const superAdminRole = roles.find(r => r.role === 'super_admin' && r.society_id === null);
        if (superAdminRole) return 'super_admin';
        
        // Find role in current society
        if (currentSocietyId) {
          const societyRole = roles.find(r => r.society_id === currentSocietyId);
          return societyRole?.role || null;
        }
        
        // Return first available role
        return roles[0]?.role || null;
      },
      
      hasRole: (role) => {
        const { roles, currentSocietyId } = get();
        return roles.some(r => 
          r.role === role && 
          (r.society_id === currentSocietyId || r.society_id === null)
        );
      },
      
      canAccessSociety: (societyId) => {
        const { roles } = get();
        return roles.some(r => 
          r.role === 'super_admin' || 
          r.society_id === societyId
        );
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ currentSocietyId: state.currentSocietyId }),
    }
  )
);
