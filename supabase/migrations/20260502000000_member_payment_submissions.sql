-- ================================================================
-- Member Self-Service Payment Submissions
-- Members submit payments → Treasurer reviews & approves/rejects
-- Approved entries auto-create income_entries in the ledger
-- ================================================================

CREATE TYPE public.payment_submission_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_submission_type AS ENUM ('maintenance', 'society_expense', 'other');

CREATE TABLE public.member_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  flat_id UUID REFERENCES public.flats(id) ON DELETE SET NULL,

  -- Payment details (entered by member)
  submission_type public.payment_submission_type NOT NULL DEFAULT 'maintenance',
  income_head_id UUID REFERENCES public.income_heads(id) ON DELETE SET NULL, -- for maintenance/society income
  expense_head_id UUID REFERENCES public.expense_heads(id) ON DELETE SET NULL, -- for expense on behalf of society

  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_mode public.payment_mode NOT NULL,
  payment_date DATE NOT NULL,
  period_month INT, -- 1-12
  period_year INT,
  transaction_ref TEXT,
  bank_name TEXT,
  notes TEXT,

  -- Attachment (required)
  attachment_url TEXT NOT NULL,
  attachment_filename TEXT,

  -- For expense reimbursements
  is_expense_claim BOOLEAN DEFAULT false, -- true = member paid on behalf of society
  reimbursement_mode TEXT, -- how they want refund: cash/upi/bank
  adjustment_in_maintenance BOOLEAN DEFAULT false, -- adjust against maintenance dues

  -- Approval workflow
  status public.payment_submission_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- After approval, link to created income entry
  income_entry_id UUID REFERENCES public.income_entries(id) ON DELETE SET NULL,
  expense_entry_id UUID REFERENCES public.expense_entries(id) ON DELETE SET NULL,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications for status changes
CREATE TABLE public.member_payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.member_payment_submissions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.member_payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_payment_notifications ENABLE ROW LEVEL SECURITY;

-- Members see only their own submissions
CREATE POLICY "Members see own submissions"
  ON public.member_payment_submissions FOR SELECT
  TO authenticated
  USING (member_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  ));

-- Members can insert their own submissions
CREATE POLICY "Members can submit payments"
  ON public.member_payment_submissions FOR INSERT
  TO authenticated
  WITH CHECK (member_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  ));

-- Admins and committee see all submissions in their society
CREATE POLICY "Admins see all submissions"
  ON public.member_payment_submissions FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.is_society_admin_of(society_id)
    OR society_id IN (
      SELECT ur.society_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
    )
  );

-- Notifications: member sees own
CREATE POLICY "Members see own notifications"
  ON public.member_payment_notifications FOR ALL
  TO authenticated
  USING (member_id IN (
    SELECT id FROM public.members WHERE user_id = auth.uid()
  ));

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION update_member_payment_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_member_payment_submissions_updated_at
  BEFORE UPDATE ON public.member_payment_submissions
  FOR EACH ROW EXECUTE FUNCTION update_member_payment_submissions_updated_at();

-- Tenant approval fields (add to tenants table if not present)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by_member BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rent_amount DECIMAL(10,2);
