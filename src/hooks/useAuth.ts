import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { useToast } from '@/hooks/use-toast';

export function useAuth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    user, session, profile, roles, currentSocietyId, isLoading,
    setLoading, isSuperAdmin, getCurrentRole, hasRole,
  } = useAuthStore();

  const { reset: resetSociety } = useSocietyStore();
  const { reset: resetAuth } = useAuthStore();

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      toast({ title: 'Account created', description: 'Please check your email to verify your account.' });
      return { data, error: null };
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, [toast, setLoading]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
      return { data, error: null };
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, [toast, setLoading]);

  const signOut = useCallback(async () => {
    try {
      // Reset state FIRST before calling supabase signOut to avoid race condition
      // that causes buffering on login page
      resetAuth();
      resetSociety();
      // Navigate immediately before the async signout completes
      navigate('/login', { replace: true });
      // Then actually sign out from supabase
      await supabase.auth.signOut();
    } catch (error: any) {
      toast({ title: 'Error signing out', description: error.message, variant: 'destructive' });
    }
  }, [navigate, toast, resetAuth, resetSociety]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Password reset email sent', description: 'Check your email for the reset link.' });
      return { error: null };
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return { error };
    }
  }, [toast]);

  return {
    user, session, profile, roles, currentSocietyId, isLoading,
    isAuthenticated: !!session,
    isSuperAdmin: isSuperAdmin(),
    currentRole: getCurrentRole(),
    hasRole, signUp, signIn, signOut, resetPassword,
  };
}
