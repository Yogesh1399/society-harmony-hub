-- ================================================================
-- CRITICAL FIX 1: Auto-seed default group_permissions for all 
-- existing societies (they have groups but no permissions in them)
-- ================================================================

-- Helper to seed permissions for a group
CREATE OR REPLACE FUNCTION public.seed_default_permissions(_society_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  g_member uuid; g_tenant uuid; g_committee uuid; g_treasurer uuid;
  g_chairman uuid; g_secretary uuid; g_admin uuid; g_auditor uuid;
BEGIN
  SELECT id INTO g_member FROM permission_groups WHERE society_id=_society_id AND name='Member';
  SELECT id INTO g_tenant FROM permission_groups WHERE society_id=_society_id AND name='Tenant';
  SELECT id INTO g_committee FROM permission_groups WHERE society_id=_society_id AND name='Committee';
  SELECT id INTO g_treasurer FROM permission_groups WHERE society_id=_society_id AND name='Treasurer';
  SELECT id INTO g_chairman FROM permission_groups WHERE society_id=_society_id AND name='Chairman';
  SELECT id INTO g_secretary FROM permission_groups WHERE society_id=_society_id AND name='Secretary';
  SELECT id INTO g_admin FROM permission_groups WHERE society_id=_society_id AND name='Society Admin';
  SELECT id INTO g_auditor FROM permission_groups WHERE society_id=_society_id AND name='Auditor';

  -- MEMBER: view dashboard, notices, complaints, notifications, profile, family
  IF g_member IS NOT NULL THEN
    INSERT INTO group_permissions (group_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
      (g_member, 'dashboard', true, false, false, false, false),
      (g_member, 'members', true, false, false, false, false),
      (g_member, 'notices', true, false, false, false, false),
      (g_member, 'notifications', true, false, false, false, false),
      (g_member, 'complaints', true, true, false, false, false),
      (g_member, 'profile', true, true, true, false, false),
      (g_member, 'family_members', true, true, true, true, false)
    ON CONFLICT (group_id, module) DO NOTHING;
  END IF;

  -- TENANT: view notices, complaints, notifications, profile
  IF g_tenant IS NOT NULL THEN
    INSERT INTO group_permissions (group_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
      (g_tenant, 'notices', true, false, false, false, false),
      (g_tenant, 'notifications', true, false, false, false, false),
      (g_tenant, 'complaints', true, true, false, false, false),
      (g_tenant, 'profile', true, true, true, false, false)
    ON CONFLICT (group_id, module) DO NOTHING;
  END IF;

  -- COMMITTEE: full view, limited create/edit
  IF g_committee IS NOT NULL THEN
    INSERT INTO group_permissions (group_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
      (g_committee, 'dashboard', true, false, false, false, false),
      (g_committee, 'flats', true, true, true, false, false),
      (g_committee, 'members', true, true, true, false, false),
      (g_committee, 'tenants', true, true, true, false, true),
      (g_committee, 'committee', true, true, true, false, false),
      (g_committee, 'income', true, false, false, false, false),
      (g_committee, 'expenses', true, false, false, false, false),
      (g_committee, 'reports', true, false, false, false, false),
      (g_committee, 'notices', true, true, true, false, false),
      (g_committee, 'complaints', true, true, true, false, false),
      (g_committee, 'notifications', true, true, false, false, false),
      (g_committee, 'documents', true, true, false, false, false),
      (g_committee, 'maintenance', true, false, false, false, false),
      (g_committee, 'profile', true, true, true, false, false),
      (g_committee, 'family_members', true, true, true, true, false)
    ON CONFLICT (group_id, module) DO NOTHING;
  END IF;

  -- TREASURER: full financial access
  IF g_treasurer IS NOT NULL THEN
    INSERT INTO group_permissions (group_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
      (g_treasurer, 'dashboard', true, false, false, false, false),
      (g_treasurer, 'flats', true, false, false, false, false),
      (g_treasurer, 'members', true, false, false, false, false),
      (g_treasurer, 'income', true, true, true, true, true),
      (g_treasurer, 'expenses', true, true, true, true, false),
      (g_treasurer, 'maintenance', true, true, true, true, false),
      (g_treasurer, 'reports', true, true, false, false, false),
      (g_treasurer, 'notices', true, false, false, false, false),
      (g_treasurer, 'notifications', true, false, false, false, false),
      (g_treasurer, 'complaints', true, false, false, false, false),
      (g_treasurer, 'documents', true, true, false, false, false),
      (g_treasurer, 'profile', true, true, true, false, false)
    ON CONFLICT (group_id, module) DO NOTHING;
  END IF;

  -- CHAIRMAN: full access + final approvals
  IF g_chairman IS NOT NULL THEN
    INSERT INTO group_permissions (group_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
      (g_chairman, 'dashboard', true, false, false, false, false),
      (g_chairman, 'flats', true, true, true, true, true),
      (g_chairman, 'members', true, true, true, true, true),
      (g_chairman, 'tenants', true, true, true, true, true),
      (g_chairman, 'committee', true, true, true, true, false),
      (g_chairman, 'income', true, true, true, true, true),
      (g_chairman, 'expenses', true, true, true, true, true),
      (g_chairman, 'maintenance', true, true, true, true, true),
      (g_chairman, 'reports', true, true, false, false, false),
      (g_chairman, 'notices', true, true, true, true, false),
      (g_chairman, 'complaints', true, true, true, true, false),
      (g_chairman, 'notifications', true, true, true, false, false),
      (g_chairman, 'documents', true, true, true, true, false),
      (g_chairman, 'profile', true, true, true, false, false)
    ON CONFLICT (group_id, module) DO NOTHING;
  END IF;

  -- SECRETARY: management access
  IF g_secretary IS NOT NULL THEN
    INSERT INTO group_permissions (group_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
      (g_secretary, 'dashboard', true, false, false, false, false),
      (g_secretary, 'flats', true, true, true, false, false),
      (g_secretary, 'members', true, true, true, false, false),
      (g_secretary, 'tenants', true, true, true, false, true),
      (g_secretary, 'committee', true, true, true, false, false),
      (g_secretary, 'income', true, false, false, false, false),
      (g_secretary, 'expenses', true, true, true, false, true),
      (g_secretary, 'maintenance', true, true, false, false, false),
      (g_secretary, 'reports', true, false, false, false, false),
      (g_secretary, 'notices', true, true, true, true, false),
      (g_secretary, 'complaints', true, true, true, false, false),
      (g_secretary, 'notifications', true, true, true, false, false),
      (g_secretary, 'documents', true, true, true, false, false),
      (g_secretary, 'profile', true, true, true, false, false)
    ON CONFLICT (group_id, module) DO NOTHING;
  END IF;

  -- SOCIETY ADMIN: everything
  IF g_admin IS NOT NULL THEN
    INSERT INTO group_permissions (group_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
      (g_admin, 'dashboard', true, true, true, true, true),
      (g_admin, 'flats', true, true, true, true, true),
      (g_admin, 'members', true, true, true, true, true),
      (g_admin, 'tenants', true, true, true, true, true),
      (g_admin, 'committee', true, true, true, true, true),
      (g_admin, 'income', true, true, true, true, true),
      (g_admin, 'expenses', true, true, true, true, true),
      (g_admin, 'maintenance', true, true, true, true, true),
      (g_admin, 'reports', true, true, true, true, true),
      (g_admin, 'notices', true, true, true, true, true),
      (g_admin, 'complaints', true, true, true, true, true),
      (g_admin, 'notifications', true, true, true, true, true),
      (g_admin, 'documents', true, true, true, true, true),
      (g_admin, 'profile', true, true, true, true, true)
    ON CONFLICT (group_id, module) DO NOTHING;
  END IF;

  -- AUDITOR: view only
  IF g_auditor IS NOT NULL THEN
    INSERT INTO group_permissions (group_id, module, can_view, can_create, can_edit, can_delete, can_approve) VALUES
      (g_auditor, 'dashboard', true, false, false, false, false),
      (g_auditor, 'income', true, false, false, false, false),
      (g_auditor, 'expenses', true, false, false, false, false),
      (g_auditor, 'maintenance', true, false, false, false, false),
      (g_auditor, 'reports', true, false, false, false, false),
      (g_auditor, 'members', true, false, false, false, false)
    ON CONFLICT (group_id, module) DO NOTHING;
  END IF;
END; $$;

-- Run for ALL existing societies
DO $$
DECLARE soc_id uuid;
BEGIN
  FOR soc_id IN SELECT id FROM public.societies LOOP
    PERFORM public.seed_default_permissions(soc_id);
  END LOOP;
END; $$;

-- ================================================================
-- CRITICAL FIX 2: Auto-assign user_group_assignments based on 
-- user_roles table (so existing users get their group permissions)
-- ================================================================
DO $$
DECLARE
  r RECORD;
  g_id uuid;
  grp_name text;
BEGIN
  FOR r IN 
    SELECT ur.user_id, ur.society_id, ur.role 
    FROM public.user_roles ur
    WHERE ur.society_id IS NOT NULL AND ur.role != 'super_admin'
  LOOP
    grp_name := CASE r.role
      WHEN 'society_admin'     THEN 'Society Admin'
      WHEN 'committee_member'  THEN 'Committee'
      WHEN 'flat_owner'        THEN 'Member'
      WHEN 'tenant'            THEN 'Tenant'
      WHEN 'auditor'           THEN 'Auditor'
      ELSE NULL
    END;
    IF grp_name IS NULL THEN CONTINUE; END IF;
    
    SELECT id INTO g_id FROM public.permission_groups 
    WHERE society_id = r.society_id AND name = grp_name LIMIT 1;
    
    IF g_id IS NOT NULL THEN
      INSERT INTO public.user_group_assignments (user_id, group_id, society_id)
      VALUES (r.user_id, g_id, r.society_id)
      ON CONFLICT (user_id, group_id, society_id) DO NOTHING;
    END IF;
  END LOOP;
END; $$;

-- ================================================================
-- CRITICAL FIX 3: Auto-assign committee members to their 
-- committee role group (Chairman/Secretary/Treasurer) based on
-- committee_members table
-- ================================================================
DO $$
DECLARE
  r RECORD;
  g_id uuid;
  grp_name text;
BEGIN
  FOR r IN
    SELECT cm.society_id, m.user_id, cm.role::text as cm_role
    FROM public.committee_members cm
    JOIN public.members m ON m.id = cm.member_id
    WHERE m.user_id IS NOT NULL AND cm.is_active = true
  LOOP
    grp_name := CASE r.cm_role
      WHEN 'chairman'   THEN 'Chairman'
      WHEN 'secretary'  THEN 'Secretary'
      WHEN 'treasurer'  THEN 'Treasurer'
      ELSE 'Committee'
    END;
    
    SELECT id INTO g_id FROM public.permission_groups
    WHERE society_id = r.society_id AND name = grp_name LIMIT 1;
    
    IF g_id IS NOT NULL AND r.user_id IS NOT NULL THEN
      INSERT INTO public.user_group_assignments (user_id, group_id, society_id)
      VALUES (r.user_id, g_id, r.society_id)
      ON CONFLICT (user_id, group_id, society_id) DO NOTHING;
    END IF;
  END LOOP;
END; $$;

-- ================================================================
-- CRITICAL FIX 4: Auto-assign groups when committee_members updated
-- ================================================================
CREATE OR REPLACE FUNCTION public.sync_committee_group_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  u_id uuid; g_id uuid; s_id uuid; grp_name text;
BEGIN
  SELECT user_id INTO u_id FROM public.members WHERE id = COALESCE(NEW.member_id, OLD.member_id);
  s_id := COALESCE(NEW.society_id, OLD.society_id);
  
  IF u_id IS NULL THEN RETURN NEW; END IF;
  
  grp_name := CASE COALESCE(NEW.role::text, '')
    WHEN 'chairman'   THEN 'Chairman'
    WHEN 'secretary'  THEN 'Secretary'
    WHEN 'treasurer'  THEN 'Treasurer'
    ELSE 'Committee'
  END;
  
  SELECT id INTO g_id FROM public.permission_groups WHERE society_id = s_id AND name = grp_name;
  
  IF g_id IS NOT NULL AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_active = true)) THEN
    INSERT INTO public.user_group_assignments (user_id, group_id, society_id)
    VALUES (u_id, g_id, s_id)
    ON CONFLICT (user_id, group_id, society_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_committee_group ON public.committee_members;
CREATE TRIGGER trg_sync_committee_group
  AFTER INSERT OR UPDATE ON public.committee_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_committee_group_assignment();

-- ================================================================
-- CRITICAL FIX 5: Auto-assign group when user_roles updated
-- ================================================================
CREATE OR REPLACE FUNCTION public.sync_role_group_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  g_id uuid; grp_name text;
BEGIN
  IF NEW.society_id IS NULL OR NEW.role = 'super_admin' THEN RETURN NEW; END IF;
  grp_name := CASE NEW.role
    WHEN 'society_admin'     THEN 'Society Admin'
    WHEN 'committee_member'  THEN 'Committee'
    WHEN 'flat_owner'        THEN 'Member'
    WHEN 'tenant'            THEN 'Tenant'
    WHEN 'auditor'           THEN 'Auditor'
    ELSE NULL
  END;
  IF grp_name IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO g_id FROM public.permission_groups WHERE society_id = NEW.society_id AND name = grp_name;
  IF g_id IS NOT NULL THEN
    INSERT INTO public.user_group_assignments (user_id, group_id, society_id)
    VALUES (NEW.user_id, g_id, NEW.society_id)
    ON CONFLICT (user_id, group_id, society_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_role_group ON public.user_roles;
CREATE TRIGGER trg_sync_role_group
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_group_assignment();

-- ================================================================
-- CRITICAL FIX 6: member_payment_submissions RLS — members can 
-- only see their own, admins/committee see all
-- ================================================================
DROP POLICY IF EXISTS "Members see own submissions" ON public.member_payment_submissions;
DROP POLICY IF EXISTS "Admins see all submissions" ON public.member_payment_submissions;
DROP POLICY IF EXISTS "Members can submit payments" ON public.member_payment_submissions;

CREATE POLICY "Members see own submissions" ON public.member_payment_submissions
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR public.is_super_admin()
    OR public.is_society_admin_of(society_id)
    OR society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('committee_member')
    )
  );

CREATE POLICY "Members can insert own submissions" ON public.member_payment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR public.is_super_admin()
    OR public.is_society_admin_of(society_id)
  );

CREATE POLICY "Admins update submissions" ON public.member_payment_submissions
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_society_admin_of(society_id)
    OR society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('committee_member')
    )
  );

-- ================================================================
-- CRITICAL FIX 7: member_payment_notifications RLS
-- ================================================================
ALTER TABLE public.member_payment_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see own notifications" ON public.member_payment_notifications;
CREATE POLICY "Access member notifications" ON public.member_payment_notifications
  FOR ALL TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR public.is_super_admin()
    OR public.is_society_admin_of(
      (SELECT society_id FROM public.member_payment_submissions WHERE id = submission_id LIMIT 1)
    )
  );

-- ================================================================
-- CRITICAL FIX 8: Seed maintenance_bills for existing societies
-- (use bill_month as text matching existing schema)
-- ================================================================

-- ================================================================  
-- FIX 9: Update handle_new_society to also seed permissions
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_society()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.feature_settings (society_id) VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.notification_settings (society_id) VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.maintenance_settings (society_id) VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
  
  INSERT INTO public.income_heads (society_id, head_name, description) VALUES
    (NEW.id, 'Maintenance', 'Monthly maintenance charges'),
    (NEW.id, 'Parking', 'Parking fees'),
    (NEW.id, 'Sinking Fund', 'Sinking fund contribution'),
    (NEW.id, 'Water Charges', 'Water usage charges'),
    (NEW.id, 'Other Income', 'Miscellaneous income')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.expense_heads (society_id, head_name, description) VALUES
    (NEW.id, 'Electricity', 'Common area electricity'),
    (NEW.id, 'Security', 'Security guard salaries'),
    (NEW.id, 'Cleaning', 'Housekeeping and cleaning'),
    (NEW.id, 'Repairs', 'Maintenance and repairs'),
    (NEW.id, 'Admin Expenses', 'Administrative expenses')
  ON CONFLICT DO NOTHING;
  
  INSERT INTO public.receipt_series (society_id, receipt_type, financial_year, prefix) VALUES
    (NEW.id, 'income', '2025-26', 'RCP'),
    (NEW.id, 'expense', '2025-26', 'VCH')
  ON CONFLICT DO NOTHING;

  -- Create default permission groups
  INSERT INTO public.permission_groups (society_id, name, description, is_system) VALUES
    (NEW.id, 'Member', 'Flat owner / member with basic access', true),
    (NEW.id, 'Tenant', 'Tenant with limited access', true),
    (NEW.id, 'Committee', 'Committee member access', true),
    (NEW.id, 'Treasurer', 'Financial management access', true),
    (NEW.id, 'Chairman', 'Chairman with approval access', true),
    (NEW.id, 'Secretary', 'Secretary with management access', true),
    (NEW.id, 'Society Admin', 'Full society administration', true),
    (NEW.id, 'Auditor', 'Read-only audit access', true)
  ON CONFLICT DO NOTHING;

  -- Seed default permissions
  PERFORM public.seed_default_permissions(NEW.id);

  INSERT INTO public.maintenance_heads (society_id, head_name, description, amount) VALUES
    (NEW.id, 'General Maintenance', 'Monthly maintenance charges', 0),
    (NEW.id, 'Water Charges', 'Water usage charges', 0),
    (NEW.id, 'Sinking Fund', 'Sinking fund contribution', 0),
    (NEW.id, 'Parking Charges', 'Parking fees', 0)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END; $$;

