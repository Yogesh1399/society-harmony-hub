-- ===========================================
-- PHASE 1: ENUMS AND BASE TYPES
-- ===========================================

-- App roles enum (stored in separate table, not on profiles)
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'society_admin',
  'committee_member',
  'flat_owner',
  'tenant',
  'auditor'
);

-- Package types for societies
CREATE TYPE public.package_type AS ENUM ('basic', 'standard', 'professional');

-- Payment modes
CREATE TYPE public.payment_mode AS ENUM ('cash', 'cheque', 'neft', 'upi', 'card');

-- Flat status
CREATE TYPE public.flat_status AS ENUM ('owner_occupied', 'rented', 'vacant');

-- Complaint status
CREATE TYPE public.complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Complaint priority
CREATE TYPE public.complaint_priority AS ENUM ('low', 'medium', 'high');

-- Committee roles
CREATE TYPE public.committee_role AS ENUM ('chairman', 'secretary', 'treasurer', 'member');

-- ===========================================
-- PHASE 2: CORE TABLES
-- ===========================================

-- Societies table (multi-tenant root)
CREATE TABLE public.societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_no TEXT,
  registration_date DATE,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  pan_number TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_ifsc TEXT,
  financial_year TEXT DEFAULT '2024-25',
  logo_url TEXT,
  package_type public.package_type DEFAULT 'basic',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  mobile TEXT,
  profile_photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (SEPARATE from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, society_id, role)
);

-- Feature settings per society
CREATE TABLE public.feature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE UNIQUE NOT NULL,
  -- Core Features
  enable_tenant_management BOOLEAN DEFAULT false,
  enable_committee_management BOOLEAN DEFAULT false,
  enable_bank_reconciliation BOOLEAN DEFAULT false,
  enable_online_payment BOOLEAN DEFAULT false,
  -- Advanced Features
  enable_visitor_management BOOLEAN DEFAULT false,
  enable_amenity_booking BOOLEAN DEFAULT false,
  enable_asset_management BOOLEAN DEFAULT false,
  enable_vendor_management BOOLEAN DEFAULT false,
  enable_meeting_management BOOLEAN DEFAULT false,
  enable_document_management BOOLEAN DEFAULT true,
  -- Integrations
  enable_whatsapp BOOLEAN DEFAULT false,
  enable_sms BOOLEAN DEFAULT false,
  enable_email BOOLEAN DEFAULT true,
  -- UI
  enable_multi_language BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- PHASE 3: SOCIETY DATA TABLES
-- ===========================================

-- Flats
CREATE TABLE public.flats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  flat_number TEXT NOT NULL,
  wing TEXT,
  floor INTEGER,
  area_sqft DECIMAL,
  parking_slots INTEGER DEFAULT 0,
  status public.flat_status DEFAULT 'vacant',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(society_id, flat_number)
);

-- Members (Flat Owners)
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  flat_id UUID REFERENCES public.flats(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  aadhar_masked TEXT,
  pan_masked TEXT,
  ownership_date DATE,
  photo_url TEXT,
  share_certificate_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Family members
CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  relation TEXT,
  date_of_birth DATE,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  flat_id UUID REFERENCES public.flats(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  aadhar_masked TEXT,
  native_address TEXT,
  photo_url TEXT,
  rent_agreement_url TEXT,
  police_verification_url TEXT,
  validity_from DATE,
  validity_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Committee members
CREATE TABLE public.committee_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  role public.committee_role NOT NULL,
  term_start DATE,
  term_end DATE,
  resolution_doc_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- PHASE 4: FINANCIAL TABLES
-- ===========================================

-- Income heads (master)
CREATE TABLE public.income_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  head_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(society_id, head_name)
);

-- Expense heads (master)
CREATE TABLE public.expense_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  head_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(society_id, head_name)
);

-- Receipt series for auto-numbering
CREATE TABLE public.receipt_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  receipt_type TEXT NOT NULL, -- income, expense
  financial_year TEXT NOT NULL,
  prefix TEXT NOT NULL,
  current_number INTEGER DEFAULT 0,
  last_reset_date DATE,
  UNIQUE(society_id, receipt_type, financial_year)
);

-- Income entries
CREATE TABLE public.income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  flat_id UUID REFERENCES public.flats(id) ON DELETE SET NULL,
  total_amount DECIMAL NOT NULL,
  payment_mode public.payment_mode,
  transaction_ref TEXT,
  bank_name TEXT,
  period_from DATE,
  period_to DATE,
  collected_by TEXT,
  notes TEXT,
  is_cancelled BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(society_id, receipt_number)
);

-- Income entry details (breakdown by heads)
CREATE TABLE public.income_entry_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  income_entry_id UUID REFERENCES public.income_entries(id) ON DELETE CASCADE NOT NULL,
  income_head_id UUID REFERENCES public.income_heads(id) ON DELETE SET NULL,
  amount DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expense entries
CREATE TABLE public.expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  voucher_number TEXT NOT NULL,
  voucher_date DATE NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_address TEXT,
  expense_head_id UUID REFERENCES public.expense_heads(id) ON DELETE SET NULL,
  amount DECIMAL NOT NULL,
  gst_amount DECIMAL DEFAULT 0,
  tds_amount DECIMAL DEFAULT 0,
  net_amount DECIMAL NOT NULL,
  payment_mode public.payment_mode,
  transaction_ref TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  invoice_url TEXT,
  description TEXT,
  approved_by TEXT,
  paid_by TEXT,
  is_cancelled BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(society_id, voucher_number)
);

-- ===========================================
-- PHASE 5: COMMUNICATION & MISC TABLES
-- ===========================================

-- Notices
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  notice_date DATE NOT NULL,
  attachment_url TEXT,
  visible_to TEXT DEFAULT 'all', -- all, owners, tenants
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Complaints
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  flat_id UUID REFERENCES public.flats(id) ON DELETE SET NULL,
  raised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT,
  priority public.complaint_priority DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  status public.complaint_status DEFAULT 'open',
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents (generic storage)
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL, -- society_docs, member_docs, tenant_docs
  entity_id UUID, -- Can be society_id, member_id, tenant_id
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- create, update, delete
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- PHASE 6: HELPER FUNCTIONS (SECURITY DEFINER)
-- ===========================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND society_id IS NULL
  )
$$;

-- Check if user has a specific role in a society
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role, _society_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (society_id = _society_id OR (_society_id IS NULL AND society_id IS NULL))
  )
$$;

-- Check if user has access to a society
CREATE OR REPLACE FUNCTION public.has_society_access(_society_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (society_id = _society_id OR (role = 'super_admin' AND society_id IS NULL))
  )
$$;

-- Get user's society IDs
CREATE OR REPLACE FUNCTION public.get_user_society_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT society_id FROM public.user_roles
  WHERE user_id = auth.uid()
    AND society_id IS NOT NULL
$$;

-- Get user's primary role in a society
CREATE OR REPLACE FUNCTION public.get_user_role_in_society(_society_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid()
    AND society_id = _society_id
  ORDER BY 
    CASE role
      WHEN 'society_admin' THEN 1
      WHEN 'committee_member' THEN 2
      WHEN 'flat_owner' THEN 3
      WHEN 'tenant' THEN 4
      WHEN 'auditor' THEN 5
      ELSE 6
    END
  LIMIT 1
$$;

-- ===========================================
-- PHASE 7: ENABLE RLS ON ALL TABLES
-- ===========================================

ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_entry_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- PHASE 8: RLS POLICIES
-- ===========================================

-- PROFILES policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- USER_ROLES policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Society admins can view society roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

CREATE POLICY "Society admins can manage society roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'society_admin'
    )
    AND role NOT IN ('super_admin')
  );

-- SOCIETIES policies
CREATE POLICY "Super admins can manage all societies"
  ON public.societies FOR ALL
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Users can view their societies"
  ON public.societies FOR SELECT
  TO authenticated
  USING (public.has_society_access(id));

CREATE POLICY "Society admins can update their society"
  ON public.societies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'society_admin'
    )
  );

-- FEATURE_SETTINGS policies
CREATE POLICY "Super admins can manage all feature settings"
  ON public.feature_settings FOR ALL
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Society admins can manage their feature settings"
  ON public.feature_settings FOR ALL
  TO authenticated
  USING (public.has_society_access(society_id));

-- FLATS policies
CREATE POLICY "Users can view flats in their society"
  ON public.flats FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage flats"
  ON public.flats FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- MEMBERS policies
CREATE POLICY "Users can view members in their society"
  ON public.members FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage members"
  ON public.members FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- FAMILY_MEMBERS policies
CREATE POLICY "Users can view family members in their society"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM public.members m
      WHERE public.has_society_access(m.society_id)
    )
  );

CREATE POLICY "Admins can manage family members"
  ON public.family_members FOR ALL
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM public.members m
      WHERE public.is_super_admin() OR m.society_id IN (
        SELECT ur.society_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
      )
    )
  );

-- TENANTS policies
CREATE POLICY "Users can view tenants in their society"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage tenants"
  ON public.tenants FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- COMMITTEE_MEMBERS policies
CREATE POLICY "Users can view committee members"
  ON public.committee_members FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Society admins can manage committee"
  ON public.committee_members FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'society_admin'
    )
  );

-- INCOME_HEADS policies
CREATE POLICY "Users can view income heads"
  ON public.income_heads FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage income heads"
  ON public.income_heads FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- EXPENSE_HEADS policies
CREATE POLICY "Users can view expense heads"
  ON public.expense_heads FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage expense heads"
  ON public.expense_heads FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- RECEIPT_SERIES policies
CREATE POLICY "Admins can manage receipt series"
  ON public.receipt_series FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- INCOME_ENTRIES policies
CREATE POLICY "Users can view income in their society"
  ON public.income_entries FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage income entries"
  ON public.income_entries FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- INCOME_ENTRY_DETAILS policies
CREATE POLICY "Users can view income details"
  ON public.income_entry_details FOR SELECT
  TO authenticated
  USING (
    income_entry_id IN (
      SELECT ie.id FROM public.income_entries ie
      WHERE public.has_society_access(ie.society_id)
    )
  );

CREATE POLICY "Admins can manage income details"
  ON public.income_entry_details FOR ALL
  TO authenticated
  USING (
    income_entry_id IN (
      SELECT ie.id FROM public.income_entries ie
      WHERE public.is_super_admin() OR ie.society_id IN (
        SELECT ur.society_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
      )
    )
  );

-- EXPENSE_ENTRIES policies
CREATE POLICY "Users can view expenses in their society"
  ON public.expense_entries FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage expense entries"
  ON public.expense_entries FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- NOTICES policies
CREATE POLICY "Users can view notices in their society"
  ON public.notices FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage notices"
  ON public.notices FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- COMPLAINTS policies
CREATE POLICY "Users can view complaints in their society"
  ON public.complaints FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Users can create complaints"
  ON public.complaints FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_society_access(society_id) AND
    raised_by = auth.uid()
  );

CREATE POLICY "Admins can manage complaints"
  ON public.complaints FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    ) OR
    raised_by = auth.uid()
  );

CREATE POLICY "Admins can delete complaints"
  ON public.complaints FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- DOCUMENTS policies
CREATE POLICY "Users can view documents in their society"
  ON public.documents FOR SELECT
  TO authenticated
  USING (public.has_society_access(society_id));

CREATE POLICY "Admins can manage documents"
  ON public.documents FOR ALL
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- AUDIT_LOGS policies (read-only for admins)
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin() OR
    society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'auditor')
    )
  );

-- ===========================================
-- PHASE 9: TRIGGERS
-- ===========================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER set_societies_updated_at
  BEFORE UPDATE ON public.societies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_flats_updated_at
  BEFORE UPDATE ON public.flats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_income_entries_updated_at
  BEFORE UPDATE ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_expense_entries_updated_at
  BEFORE UPDATE ON public.expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_notices_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_complaints_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_feature_settings_updated_at
  BEFORE UPDATE ON public.feature_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ===========================================
-- PHASE 10: AUTO-CREATE PROFILE ON SIGNUP
-- ===========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- PHASE 11: AUTO-CREATE FEATURE SETTINGS FOR NEW SOCIETY
-- ===========================================

CREATE OR REPLACE FUNCTION public.handle_new_society()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.feature_settings (society_id)
  VALUES (NEW.id);
  
  -- Create default income heads
  INSERT INTO public.income_heads (society_id, head_name, description) VALUES
    (NEW.id, 'Maintenance', 'Monthly maintenance charges'),
    (NEW.id, 'Parking', 'Parking fees'),
    (NEW.id, 'Sinking Fund', 'Sinking fund contribution'),
    (NEW.id, 'Water Charges', 'Water usage charges'),
    (NEW.id, 'Other Income', 'Miscellaneous income');
  
  -- Create default expense heads
  INSERT INTO public.expense_heads (society_id, head_name, description) VALUES
    (NEW.id, 'Electricity', 'Common area electricity'),
    (NEW.id, 'Security', 'Security guard salaries'),
    (NEW.id, 'Cleaning', 'Housekeeping and cleaning'),
    (NEW.id, 'Repairs', 'Maintenance and repairs'),
    (NEW.id, 'Admin Expenses', 'Administrative expenses');
  
  -- Create receipt series
  INSERT INTO public.receipt_series (society_id, receipt_type, financial_year, prefix) VALUES
    (NEW.id, 'income', '2024-25', 'RCP'),
    (NEW.id, 'expense', '2024-25', 'VCH');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_society_created
  AFTER INSERT ON public.societies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_society();