
-- Fix ALL restrictive policies on societies table - change to PERMISSIVE
DROP POLICY IF EXISTS "Super admins can manage all societies" ON public.societies;
DROP POLICY IF EXISTS "Users can view their societies" ON public.societies;
DROP POLICY IF EXISTS "Society admins can update their society" ON public.societies;

-- Recreate as PERMISSIVE (default) policies
CREATE POLICY "Super admins can manage all societies"
ON public.societies
FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Users can view their societies"
ON public.societies
FOR SELECT
TO authenticated
USING (has_society_access(id));

CREATE POLICY "Society admins can update their society"
ON public.societies
FOR UPDATE
TO authenticated
USING (is_society_admin_of(id));

-- Also fix feature_settings policies (same issue)
DROP POLICY IF EXISTS "Society admins can manage their feature settings" ON public.feature_settings;
DROP POLICY IF EXISTS "Super admins can manage all feature settings" ON public.feature_settings;

CREATE POLICY "Super admins can manage all feature settings"
ON public.feature_settings
FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Society admins can manage their feature settings"
ON public.feature_settings
FOR ALL
TO authenticated
USING (has_society_access(society_id))
WITH CHECK (has_society_access(society_id));

-- Fix receipt_series policies
DROP POLICY IF EXISTS "Admins can manage receipt series" ON public.receipt_series;

CREATE POLICY "Admins can manage receipt series"
ON public.receipt_series
FOR ALL
TO authenticated
USING (is_super_admin() OR is_society_admin_of(society_id))
WITH CHECK (is_super_admin() OR is_society_admin_of(society_id));

-- Fix income_heads policies
DROP POLICY IF EXISTS "Admins can manage income heads" ON public.income_heads;
DROP POLICY IF EXISTS "Users can view income heads" ON public.income_heads;

CREATE POLICY "Admins can manage income heads"
ON public.income_heads
FOR ALL
TO authenticated
USING (is_super_admin() OR has_society_access(society_id))
WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view income heads"
ON public.income_heads
FOR SELECT
TO authenticated
USING (has_society_access(society_id));

-- Fix expense_heads policies
DROP POLICY IF EXISTS "Admins can manage expense heads" ON public.expense_heads;
DROP POLICY IF EXISTS "Users can view expense heads" ON public.expense_heads;

CREATE POLICY "Admins can manage expense heads"
ON public.expense_heads
FOR ALL
TO authenticated
USING (is_super_admin() OR has_society_access(society_id))
WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view expense heads"
ON public.expense_heads
FOR SELECT
TO authenticated
USING (has_society_access(society_id));

-- Fix all other table policies to be PERMISSIVE
-- flats
DROP POLICY IF EXISTS "Admins can manage flats" ON public.flats;
DROP POLICY IF EXISTS "Users can view flats in their society" ON public.flats;

CREATE POLICY "Admins can manage flats"
ON public.flats FOR ALL TO authenticated
USING (is_super_admin() OR has_society_access(society_id))
WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view flats in their society"
ON public.flats FOR SELECT TO authenticated
USING (has_society_access(society_id));

-- members
DROP POLICY IF EXISTS "Admins can manage members" ON public.members;
DROP POLICY IF EXISTS "Users can view members in their society" ON public.members;

CREATE POLICY "Admins can manage members"
ON public.members FOR ALL TO authenticated
USING (is_super_admin() OR has_society_access(society_id))
WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view members in their society"
ON public.members FOR SELECT TO authenticated
USING (has_society_access(society_id));

-- income_entries
DROP POLICY IF EXISTS "Admins can manage income entries" ON public.income_entries;
DROP POLICY IF EXISTS "Users can view income in their society" ON public.income_entries;

CREATE POLICY "Admins can manage income entries"
ON public.income_entries FOR ALL TO authenticated
USING (is_super_admin() OR has_society_access(society_id))
WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view income in their society"
ON public.income_entries FOR SELECT TO authenticated
USING (has_society_access(society_id));

-- expense_entries
DROP POLICY IF EXISTS "Admins can manage expense entries" ON public.expense_entries;
DROP POLICY IF EXISTS "Users can view expenses in their society" ON public.expense_entries;

CREATE POLICY "Admins can manage expense entries"
ON public.expense_entries FOR ALL TO authenticated
USING (is_super_admin() OR has_society_access(society_id))
WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view expenses in their society"
ON public.expense_entries FOR SELECT TO authenticated
USING (has_society_access(society_id));

-- notices
DROP POLICY IF EXISTS "Admins can manage notices" ON public.notices;
DROP POLICY IF EXISTS "Users can view notices in their society" ON public.notices;

CREATE POLICY "Admins can manage notices"
ON public.notices FOR ALL TO authenticated
USING (is_super_admin() OR has_society_access(society_id))
WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view notices in their society"
ON public.notices FOR SELECT TO authenticated
USING (has_society_access(society_id));

-- complaints
DROP POLICY IF EXISTS "Admins can manage complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can delete complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can view complaints in their society" ON public.complaints;

CREATE POLICY "Admins can manage complaints"
ON public.complaints FOR ALL TO authenticated
USING (is_super_admin() OR has_society_access(society_id))
WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view complaints in their society"
ON public.complaints FOR SELECT TO authenticated
USING (has_society_access(society_id));

CREATE POLICY "Users can create complaints"
ON public.complaints FOR INSERT TO authenticated
WITH CHECK (has_society_access(society_id));

-- audit_logs - make INSERT possible for logging
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);
