import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';

/**
 * AuthProvider initializes and manages the auth state globally.
 * Must be placed inside BrowserRouter but wrapping all routes.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mountedRef = useRef(true);
  const {
    currentSocietyId,
    setUser,
    setSession,
    setProfile,
    setRoles,
    setCurrentSocietyId,
    setLoading,
    reset: resetAuth,
  } = useAuthStore();
  
  const { 
    setCurrentSociety, 
    setSocieties,
    setFeatures,
    reset: resetSociety 
  } = useSocietyStore();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) { console.error('Error fetching profile:', error); return null; }
    return data;
  }, []);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId);
    if (error) { console.error('Error fetching roles:', error); return []; }
    return data || [];
  }, []);

  const fetchSocieties = useCallback(async () => {
    const { data, error } = await supabase
      .from('societies')
      .select('*')
      .eq('is_active', true);
    if (error) { console.error('Error fetching societies:', error); return []; }
    return data || [];
  }, []);

  const fetchFeatures = useCallback(async (societyId: string) => {
    const { data, error } = await supabase
      .from('feature_settings')
      .select('*')
      .eq('society_id', societyId)
      .single();
    if (error) { console.error('Error fetching features:', error); return null; }
    return data;
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const [profileData, rolesData, societiesData] = await Promise.all([
        fetchProfile(userId),
        fetchRoles(userId),
        fetchSocieties(),
      ]);

      if (!mountedRef.current) return;

      setProfile(profileData);
      setRoles(rolesData);
      setSocieties(societiesData);

      // Set current society if not already set
      const currentId = useAuthStore.getState().currentSocietyId;
      let activeSocietyId = currentId;

      if (!activeSocietyId) {
        // Try from roles first
        const firstSocietyRole = rolesData.find(r => r.society_id);
        if (firstSocietyRole?.society_id) {
          activeSocietyId = firstSocietyRole.society_id;
        } else if (societiesData.length > 0) {
          // Fallback: auto-select first society from the list
          activeSocietyId = societiesData[0].id;
        }
        if (activeSocietyId) {
          setCurrentSocietyId(activeSocietyId);
        }
      }

      // Load society + features
      if (activeSocietyId) {
        const society = societiesData.find(s => s.id === activeSocietyId);
        if (society) {
          setCurrentSociety(society);
          const features = await fetchFeatures(activeSocietyId);
          if (mountedRef.current) setFeatures(features);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchProfile, fetchRoles, fetchSocieties, fetchFeatures, setProfile, setRoles, setSocieties, setCurrentSociety, setCurrentSocietyId, setFeatures, setLoading]);

  useEffect(() => {
    mountedRef.current = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mountedRef.current && session) {
          setSession(session);
          setUser(session.user);
          await loadUserData(session.user.id);
        } else if (mountedRef.current) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mountedRef.current) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;

        setSession(session);
        setUser(session?.user || null);

        if (event === 'SIGNED_IN' && session) {
          setTimeout(() => {
            if (mountedRef.current) loadUserData(session.user.id);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          // State is already reset by useAuth.signOut() before this fires
          // Just ensure clean state in case of external signout
          resetAuth();
          resetSociety();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session);
          setUser(session.user);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [setSession, setUser, setLoading, loadUserData, resetAuth, resetSociety]);

  return <>{children}</>;
}
