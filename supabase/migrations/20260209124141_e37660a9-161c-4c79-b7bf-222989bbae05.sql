
-- Fix infinite recursion in user_roles RLS policies
-- The issue: policies on user_roles reference user_roles in subqueries, causing recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Society admins can view society roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Society admins can manage society roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Create a security definer function to check if user is society admin
CREATE OR REPLACE FUNCTION public.is_society_admin_of(_society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'society_admin'
      AND society_id = _society_id
  )
$$;

-- Recreate policies using security definer functions (no direct subqueries on user_roles)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (is_super_admin());

CREATE POLICY "Society admins can view society roles"
ON public.user_roles
FOR SELECT
USING (is_society_admin_of(society_id));

CREATE POLICY "Society admins can insert society roles"
ON public.user_roles
FOR INSERT
WITH CHECK (is_society_admin_of(society_id) AND role <> 'super_admin');
