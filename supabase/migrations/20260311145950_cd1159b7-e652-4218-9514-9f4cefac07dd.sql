
-- 1. Create permission_groups table
CREATE TABLE public.permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(society_id, name)
);

-- 2. Create group_permissions table
CREATE TABLE public.group_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.permission_groups(id) ON DELETE CASCADE NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT false,
  can_create boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  can_approve boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, module)
);

-- 3. Create user_group_assignments table
CREATE TABLE public.user_group_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.permission_groups(id) ON DELETE CASCADE NOT NULL,
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE,
  additional_permissions jsonb DEFAULT '[]'::jsonb,
  restricted_permissions jsonb DEFAULT '[]'::jsonb,
  assigned_by uuid,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, group_id, society_id)
);

-- 4. Expand flat_status enum with new values
ALTER TYPE public.flat_status ADD VALUE IF NOT EXISTS 'available_for_tenant';
ALTER TYPE public.flat_status ADD VALUE IF NOT EXISTS 'tenant_occupied';
ALTER TYPE public.flat_status ADD VALUE IF NOT EXISTS 'under_transfer';
ALTER TYPE public.flat_status ADD VALUE IF NOT EXISTS 'builder_owned';
ALTER TYPE public.flat_status ADD VALUE IF NOT EXISTS 'society_owned';

-- 5. Add tenant verification status column
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'owner_pending' CHECK (verification_status IN ('owner_pending', 'society_pending', 'active', 'rejected'));

-- 6. Create maintenance_heads table
CREATE TABLE public.maintenance_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  head_name text NOT NULL,
  description text,
  amount numeric DEFAULT 0,
  frequency text DEFAULT 'monthly',
  calculation_type text DEFAULT 'flat_rate' CHECK (calculation_type IN ('flat_rate', 'per_sqft', 'per_unit', 'custom')),
  is_active boolean DEFAULT true,
  applicable_to text DEFAULT 'all',
  created_at timestamptz DEFAULT now(),
  UNIQUE(society_id, head_name)
);

-- 7. Create maintenance_bills table
CREATE TABLE public.maintenance_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  flat_id uuid REFERENCES public.flats(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES public.members(id),
  bill_month text NOT NULL,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL DEFAULT 0,
  penalty_amount numeric DEFAULT 0,
  interest_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  due_date date,
  paid_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(society_id, flat_id, bill_month)
);

-- 8. Create maintenance_bill_items table
CREATE TABLE public.maintenance_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid REFERENCES public.maintenance_bills(id) ON DELETE CASCADE NOT NULL,
  head_id uuid REFERENCES public.maintenance_heads(id),
  head_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 9. Create maintenance_settings table
CREATE TABLE public.maintenance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  due_day integer DEFAULT 10,
  grace_days integer DEFAULT 5,
  penalty_amount numeric DEFAULT 0,
  interest_rate numeric DEFAULT 0,
  interest_calculation text DEFAULT 'simple' CHECK (interest_calculation IN ('simple', 'compound')),
  auto_generate boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 10. Create member_ledger table
CREATE TABLE public.member_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  flat_id uuid REFERENCES public.flats(id),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  balance numeric DEFAULT 0,
  reference_type text,
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

-- 11. Enable RLS on all new tables
ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_ledger ENABLE ROW LEVEL SECURITY;

-- 12. RLS policies for permission_groups
CREATE POLICY "Admins can manage permission groups" ON public.permission_groups
  FOR ALL TO authenticated
  USING (is_super_admin() OR is_society_admin_of(society_id))
  WITH CHECK (is_super_admin() OR is_society_admin_of(society_id));

CREATE POLICY "Users can view permission groups" ON public.permission_groups
  FOR SELECT TO authenticated
  USING (has_society_access(society_id));

-- 13. RLS policies for group_permissions
CREATE POLICY "Admins can manage group permissions" ON public.group_permissions
  FOR ALL TO authenticated
  USING (group_id IN (SELECT id FROM public.permission_groups WHERE is_super_admin() OR is_society_admin_of(society_id)))
  WITH CHECK (group_id IN (SELECT id FROM public.permission_groups WHERE is_super_admin() OR is_society_admin_of(society_id)));

CREATE POLICY "Users can view group permissions" ON public.group_permissions
  FOR SELECT TO authenticated
  USING (group_id IN (SELECT id FROM public.permission_groups WHERE has_society_access(society_id)));

-- 14. RLS policies for user_group_assignments
CREATE POLICY "Admins can manage user group assignments" ON public.user_group_assignments
  FOR ALL TO authenticated
  USING (is_super_admin() OR is_society_admin_of(society_id))
  WITH CHECK (is_super_admin() OR is_society_admin_of(society_id));

CREATE POLICY "Users can view own group assignments" ON public.user_group_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin() OR is_society_admin_of(society_id));

-- 15. RLS policies for maintenance tables
CREATE POLICY "Admins can manage maintenance heads" ON public.maintenance_heads
  FOR ALL TO authenticated
  USING (is_super_admin() OR has_society_access(society_id))
  WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view maintenance heads" ON public.maintenance_heads
  FOR SELECT TO authenticated
  USING (has_society_access(society_id));

CREATE POLICY "Admins can manage maintenance bills" ON public.maintenance_bills
  FOR ALL TO authenticated
  USING (is_super_admin() OR has_society_access(society_id))
  WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view own maintenance bills" ON public.maintenance_bills
  FOR SELECT TO authenticated
  USING (has_society_access(society_id));

CREATE POLICY "Admins can manage bill items" ON public.maintenance_bill_items
  FOR ALL TO authenticated
  USING (bill_id IN (SELECT id FROM public.maintenance_bills WHERE is_super_admin() OR has_society_access(society_id)))
  WITH CHECK (bill_id IN (SELECT id FROM public.maintenance_bills WHERE is_super_admin() OR has_society_access(society_id)));

CREATE POLICY "Users can view bill items" ON public.maintenance_bill_items
  FOR SELECT TO authenticated
  USING (bill_id IN (SELECT id FROM public.maintenance_bills WHERE has_society_access(society_id)));

CREATE POLICY "Admins can manage maintenance settings" ON public.maintenance_settings
  FOR ALL TO authenticated
  USING (is_super_admin() OR is_society_admin_of(society_id))
  WITH CHECK (is_super_admin() OR is_society_admin_of(society_id));

CREATE POLICY "Users can view maintenance settings" ON public.maintenance_settings
  FOR SELECT TO authenticated
  USING (has_society_access(society_id));

CREATE POLICY "Admins can manage member ledger" ON public.member_ledger
  FOR ALL TO authenticated
  USING (is_super_admin() OR has_society_access(society_id))
  WITH CHECK (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Users can view own ledger" ON public.member_ledger
  FOR SELECT TO authenticated
  USING (has_society_access(society_id));

-- 16. Update handle_new_society to init maintenance_settings and default permission groups
CREATE OR REPLACE FUNCTION public.handle_new_society()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.feature_settings (society_id) VALUES (NEW.id);
  INSERT INTO public.notification_settings (society_id) VALUES (NEW.id);
  INSERT INTO public.maintenance_settings (society_id) VALUES (NEW.id);
  
  INSERT INTO public.income_heads (society_id, head_name, description) VALUES
    (NEW.id, 'Maintenance', 'Monthly maintenance charges'),
    (NEW.id, 'Parking', 'Parking fees'),
    (NEW.id, 'Sinking Fund', 'Sinking fund contribution'),
    (NEW.id, 'Water Charges', 'Water usage charges'),
    (NEW.id, 'Other Income', 'Miscellaneous income');
  
  INSERT INTO public.expense_heads (society_id, head_name, description) VALUES
    (NEW.id, 'Electricity', 'Common area electricity'),
    (NEW.id, 'Security', 'Security guard salaries'),
    (NEW.id, 'Cleaning', 'Housekeeping and cleaning'),
    (NEW.id, 'Repairs', 'Maintenance and repairs'),
    (NEW.id, 'Admin Expenses', 'Administrative expenses');
  
  INSERT INTO public.receipt_series (society_id, receipt_type, financial_year, prefix) VALUES
    (NEW.id, 'income', '2024-25', 'RCP'),
    (NEW.id, 'expense', '2024-25', 'VCH');

  -- Create default permission groups
  INSERT INTO public.permission_groups (society_id, name, description, is_system) VALUES
    (NEW.id, 'Member', 'Flat owner / member with basic access', true),
    (NEW.id, 'Tenant', 'Tenant with limited access', true),
    (NEW.id, 'Committee', 'Committee member access', true),
    (NEW.id, 'Treasurer', 'Financial management access', true),
    (NEW.id, 'Chairman', 'Chairman with approval access', true),
    (NEW.id, 'Secretary', 'Secretary with management access', true),
    (NEW.id, 'Society Admin', 'Full society administration', true),
    (NEW.id, 'Auditor', 'Read-only audit access', true);

  -- Default maintenance heads
  INSERT INTO public.maintenance_heads (society_id, head_name, description, amount) VALUES
    (NEW.id, 'General Maintenance', 'Monthly maintenance charges', 0),
    (NEW.id, 'Water Charges', 'Water usage charges', 0),
    (NEW.id, 'Sinking Fund', 'Sinking fund contribution', 0),
    (NEW.id, 'Parking Charges', 'Parking fees', 0);
  
  RETURN NEW;
END;
$$;
