-- ============================================================
-- 1. Storage buckets for documents & payment proofs
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('documents', 'documents', true, 52428800, -- 50MB
   ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf','image/heic']),
  ('profile-photos', 'profile-photos', true, 5242880, -- 5MB
   ARRAY['image/jpeg','image/png','image/webp','image/heic'])
ON CONFLICT (id) DO UPDATE SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies
CREATE POLICY "Public read documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Auth users upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Auth users update documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents');

CREATE POLICY "Public read profile photos" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "Auth users upload profile photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos');
CREATE POLICY "Auth users update profile photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-photos');

-- ============================================================
-- 2. Fix tenants table - add missing columns
-- ============================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' 
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by_member BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rent_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- ============================================================
-- 3. Fix flat_status enum - add more statuses
-- ============================================================
ALTER TYPE public.flat_status ADD VALUE IF NOT EXISTS 'available_for_tenant';
ALTER TYPE public.flat_status ADD VALUE IF NOT EXISTS 'available_for_sale';

-- ============================================================
-- 4. Extended family members table
-- ============================================================
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS employer TEXT,
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS is_dependent BOOLEAN DEFAULT true;

-- ============================================================
-- 5. Member & profile photo fields
-- ============================================================
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS flat_ownership_type TEXT DEFAULT 'owned' 
    CHECK (flat_ownership_type IN ('owned', 'on_loan', 'inherited'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- ============================================================
-- 6. Vendor management table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  vendor_name TEXT NOT NULL,
  contact_person TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  mobile TEXT,
  phone TEXT,
  email TEXT,
  gst_number TEXT,
  pan_number TEXT,
  aadhar_masked TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_ifsc TEXT,
  services_provided TEXT[],
  service_description TEXT,
  contract_start_date DATE,
  contract_end_date DATE,
  contract_amount DECIMAL(12,2),
  contract_document_url TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Society members view vendors" ON public.vendors FOR SELECT TO authenticated
  USING (public.has_society_access(society_id));
CREATE POLICY "Admins manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_society_admin_of(society_id) OR
    society_id IN (SELECT ur.society_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin','committee_member')));

-- Link expense_entries to vendors
ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- ============================================================
-- 7. Sub-registers (program/project tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sub_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  register_type TEXT DEFAULT 'program' CHECK (register_type IN ('program','project','event','other')),
  start_date DATE,
  end_date DATE,
  society_contribution DECIMAL(12,2) DEFAULT 0,
  target_amount DECIMAL(12,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sub_register_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_register_id UUID REFERENCES public.sub_registers(id) ON DELETE CASCADE NOT NULL,
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income','expense','contribution')),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  payment_mode TEXT,
  payment_date DATE,
  reference_no TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sub_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_register_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Society access sub_registers" ON public.sub_registers FOR ALL TO authenticated USING (public.has_society_access(society_id));
CREATE POLICY "Society access sub_register_entries" ON public.sub_register_entries FOR ALL TO authenticated USING (public.has_society_access(society_id));

-- ============================================================
-- 8. Bulk upload tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bulk_upload_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('members','flats','tenants','vendors','committee')),
  filename TEXT,
  total_rows INTEGER DEFAULT 0,
  success_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  errors JSONB,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bulk_upload_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage bulk uploads" ON public.bulk_upload_logs FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_society_admin_of(society_id));

-- ============================================================
-- 9. Maintenance bills table (for treasurer to send bills to members)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maintenance_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  bill_month INTEGER NOT NULL CHECK (bill_month BETWEEN 1 AND 12),
  bill_year INTEGER NOT NULL,
  flat_id UUID REFERENCES public.flats(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  bill_amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  is_paid BOOLEAN DEFAULT false,
  income_entry_id UUID REFERENCES public.income_entries(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(society_id, bill_month, bill_year, flat_id)
);

ALTER TABLE public.maintenance_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see own bills" ON public.maintenance_bills FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR public.has_society_access(society_id));
CREATE POLICY "Admins manage bills" ON public.maintenance_bills FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.is_society_admin_of(society_id) OR
    society_id IN (SELECT ur.society_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('committee_member')));
