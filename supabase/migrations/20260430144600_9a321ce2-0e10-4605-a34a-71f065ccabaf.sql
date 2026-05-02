
-- ============================================================
-- 1. TIGHTEN APPROVAL SECURITY (restrictive RLS)
-- ============================================================

-- Block UPDATEs to the approval workflow fields unless caller is the right approver
CREATE OR REPLACE FUNCTION public.can_update_expense_approval(
  _user_id uuid,
  _society_id uuid,
  _old_status expense_approval_status,
  _new_status expense_approval_status
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    -- super admin / society admin always allowed (they manage)
    is_super_admin()
    OR is_society_admin_of(_society_id)
    -- no change to approval status -> allowed (other field edits)
    OR _old_status IS NOT DISTINCT FROM _new_status
    -- Treasurer can submit / resubmit
    OR (
      _new_status IN ('pending_secretary')
      AND _old_status IN ('draft','rejected')
      AND is_committee_role(_user_id, _society_id, 'treasurer')
    )
    -- Secretary moves pending_secretary -> pending_chairman (or reject)
    OR (
      _old_status = 'pending_secretary'
      AND _new_status IN ('pending_chairman','rejected')
      AND is_committee_role(_user_id, _society_id, 'secretary')
    )
    -- Chairman finalises pending_chairman -> approved (or reject)
    OR (
      _old_status = 'pending_chairman'
      AND _new_status IN ('approved','rejected')
      AND is_committee_role(_user_id, _society_id, 'chairman')
    );
$$;

-- Restrictive policy enforced on every UPDATE to expense_entries
DROP POLICY IF EXISTS "Approval transitions restricted to right role" ON public.expense_entries;
CREATE POLICY "Approval transitions restricted to right role"
ON public.expense_entries
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  public.can_update_expense_approval(
    auth.uid(), society_id, approval_status, approval_status
  )
)
WITH CHECK (
  public.can_update_expense_approval(
    auth.uid(), society_id, approval_status, approval_status
  )
);

-- Note: USING evaluates against OLD row, WITH CHECK against NEW row.
-- Postgres calls the function twice — old.status passed in USING, new.status in WITH CHECK.
-- We need a different formulation: combine both. Simpler approach: split into two restrictive policies.
DROP POLICY IF EXISTS "Approval transitions restricted to right role" ON public.expense_entries;

-- Use a trigger instead (cleaner & guarantees old/new comparison)
CREATE OR REPLACE FUNCTION public.enforce_expense_approval_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- super admin or society admin can do anything
  IF is_super_admin() OR is_society_admin_of(NEW.society_id) THEN
    RETURN NEW;
  END IF;

  -- no status change -> allowed
  IF OLD.approval_status IS NOT DISTINCT FROM NEW.approval_status THEN
    RETURN NEW;
  END IF;

  -- Treasurer submitting or resubmitting
  IF NEW.approval_status = 'pending_secretary'
     AND OLD.approval_status IN ('draft','rejected')
     AND is_committee_role(v_uid, NEW.society_id, 'treasurer') THEN
    RETURN NEW;
  END IF;

  -- Secretary acting
  IF OLD.approval_status = 'pending_secretary'
     AND NEW.approval_status IN ('pending_chairman','rejected')
     AND is_committee_role(v_uid, NEW.society_id, 'secretary') THEN
    RETURN NEW;
  END IF;

  -- Chairman acting
  IF OLD.approval_status = 'pending_chairman'
     AND NEW.approval_status IN ('approved','rejected')
     AND is_committee_role(v_uid, NEW.society_id, 'chairman') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed: approval status transition % -> % requires the correct committee role',
    OLD.approval_status, NEW.approval_status
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_expense_approval_transition ON public.expense_entries;
CREATE TRIGGER trg_enforce_expense_approval_transition
BEFORE UPDATE OF approval_status ON public.expense_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_expense_approval_transition();


-- ============================================================
-- 2. BANK RECONCILIATION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  branch text,
  account_number_masked text,
  ifsc text,
  opening_balance numeric NOT NULL DEFAULT 0,
  opening_balance_date date NOT NULL DEFAULT CURRENT_DATE,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View bank accounts" ON public.bank_accounts FOR SELECT TO authenticated
USING (has_society_access(society_id));
CREATE POLICY "Manage bank accounts" ON public.bank_accounts FOR ALL TO authenticated
USING (is_super_admin() OR is_society_admin_of(society_id) OR is_committee_role(auth.uid(), society_id, 'treasurer'))
WITH CHECK (is_super_admin() OR is_society_admin_of(society_id) OR is_committee_role(auth.uid(), society_id, 'treasurer'));


CREATE TABLE IF NOT EXISTS public.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  period_from date NOT NULL,
  period_to date NOT NULL,
  file_url text,
  file_name text,
  opening_balance numeric DEFAULT 0,
  closing_balance numeric DEFAULT 0,
  total_debit numeric DEFAULT 0,
  total_credit numeric DEFAULT 0,
  entry_count int DEFAULT 0,
  parse_status text NOT NULL DEFAULT 'pending', -- pending | parsed | failed
  parse_notes text,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View bank statements" ON public.bank_statements FOR SELECT TO authenticated
USING (has_society_access(society_id));
CREATE POLICY "Manage bank statements" ON public.bank_statements FOR ALL TO authenticated
USING (is_super_admin() OR is_society_admin_of(society_id) OR is_committee_role(auth.uid(), society_id, 'treasurer'))
WITH CHECK (is_super_admin() OR is_society_admin_of(society_id) OR is_committee_role(auth.uid(), society_id, 'treasurer'));


CREATE TABLE IF NOT EXISTS public.bank_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  bank_statement_id uuid REFERENCES public.bank_statements(id) ON DELETE SET NULL,
  txn_date date NOT NULL,
  value_date date,
  description text,
  reference text,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  balance_after numeric,
  txn_type text NOT NULL DEFAULT 'unknown', -- credit | debit | unknown
  reconciliation_status text NOT NULL DEFAULT 'unmatched', -- unmatched | matched | suspense | manual
  matched_expense_id uuid,
  matched_income_id uuid,
  matched_by uuid,
  matched_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_entries_society_date ON public.bank_entries(society_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_bank_entries_status ON public.bank_entries(reconciliation_status);

ALTER TABLE public.bank_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View bank entries" ON public.bank_entries FOR SELECT TO authenticated
USING (has_society_access(society_id));
CREATE POLICY "Manage bank entries" ON public.bank_entries FOR ALL TO authenticated
USING (is_super_admin() OR is_society_admin_of(society_id) OR is_committee_role(auth.uid(), society_id, 'treasurer'))
WITH CHECK (is_super_admin() OR is_society_admin_of(society_id) OR is_committee_role(auth.uid(), society_id, 'treasurer'));


-- Add reconciliation columns to expense and income entries
ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'unreconciled',
  ADD COLUMN IF NOT EXISTS matched_bank_entry_id uuid;

ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'unreconciled',
  ADD COLUMN IF NOT EXISTS matched_bank_entry_id uuid;


-- ============================================================
-- 3. AUTO-MATCH HELPER
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_match_bank_entry(_bank_entry_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  be record;
  match_expense uuid;
  match_income uuid;
  win int := 5; -- +/- days window
BEGIN
  SELECT * INTO be FROM bank_entries WHERE id = _bank_entry_id;
  IF be IS NULL THEN
    RETURN jsonb_build_object('matched', false, 'reason', 'bank entry not found');
  END IF;

  IF be.debit > 0 THEN
    -- bank debit -> outgoing -> matches an expense
    SELECT id INTO match_expense
    FROM expense_entries
    WHERE society_id = be.society_id
      AND is_cancelled = false
      AND reconciliation_status = 'unreconciled'
      AND ABS(net_amount - be.debit) < 0.01
      AND voucher_date BETWEEN be.txn_date - win AND be.txn_date + win
    ORDER BY ABS(voucher_date - be.txn_date) ASC
    LIMIT 1;

    IF match_expense IS NOT NULL THEN
      UPDATE expense_entries SET reconciliation_status = 'reconciled', matched_bank_entry_id = be.id WHERE id = match_expense;
      UPDATE bank_entries SET reconciliation_status = 'matched', matched_expense_id = match_expense, matched_at = now(), matched_by = auth.uid() WHERE id = be.id;
      RETURN jsonb_build_object('matched', true, 'type', 'expense', 'id', match_expense);
    END IF;
  END IF;

  IF be.credit > 0 THEN
    SELECT id INTO match_income
    FROM income_entries
    WHERE society_id = be.society_id
      AND is_cancelled = false
      AND reconciliation_status = 'unreconciled'
      AND ABS(total_amount - be.credit) < 0.01
      AND receipt_date BETWEEN be.txn_date - win AND be.txn_date + win
    ORDER BY ABS(receipt_date - be.txn_date) ASC
    LIMIT 1;

    IF match_income IS NOT NULL THEN
      UPDATE income_entries SET reconciliation_status = 'reconciled', matched_bank_entry_id = be.id WHERE id = match_income;
      UPDATE bank_entries SET reconciliation_status = 'matched', matched_income_id = match_income, matched_at = now(), matched_by = auth.uid() WHERE id = be.id;
      RETURN jsonb_build_object('matched', true, 'type', 'income', 'id', match_income);
    END IF;
  END IF;

  -- nothing found -> mark suspense if amount > 0
  IF (be.debit + be.credit) > 0 THEN
    UPDATE bank_entries SET reconciliation_status = 'suspense' WHERE id = be.id AND reconciliation_status = 'unmatched';
  END IF;

  RETURN jsonb_build_object('matched', false);
END;
$$;


-- ============================================================
-- 4. STORAGE BUCKET FOR BANK STATEMENTS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "View bank statements files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bank-statements'
  AND has_society_access(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Upload bank statements files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bank-statements'
  AND (is_super_admin()
       OR is_society_admin_of(((storage.foldername(name))[1])::uuid)
       OR is_committee_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'treasurer'))
);

CREATE POLICY "Delete bank statements files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bank-statements'
  AND (is_super_admin()
       OR is_society_admin_of(((storage.foldername(name))[1])::uuid)
       OR is_committee_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'treasurer'))
);

-- updated_at triggers
CREATE TRIGGER set_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_bank_entries_updated_at BEFORE UPDATE ON public.bank_entries
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
