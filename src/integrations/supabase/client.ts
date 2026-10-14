// Supabase client configuration
// NOTE: This file points at the user's external Supabase project (ekhonguhgkzaactbxnil)
// instead of the Lovable Cloud-managed project. This is intentional per user request.
// If Lovable regenerates this file, re-apply these constants.
import { createClient } from '@supabase/supabase-js';

// Values come from .env (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
// The literals below are only a last-resort fallback for the legacy project.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://ekhonguhgkzaactbxnil.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraG9uZ3VoZ2t6YWFjdGJ4bmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjI3NjMsImV4cCI6MjA5MzEzODc2M30.7hsepYp2QEr-rI_ukLEAwEdwXfuogJhGFkAtjNWRF80";

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL not set — falling back to the legacy hardcoded project."
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<any>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});
