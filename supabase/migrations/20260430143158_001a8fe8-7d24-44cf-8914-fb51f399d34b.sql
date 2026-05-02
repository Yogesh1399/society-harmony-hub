
-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.expense_approval_status AS ENUM (
    'draft', 'pending_secretary', 'pending_chairman', 'approved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Expense approval workflow columns
ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS approval_status public.expense_approval_status DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS raised_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS raised_by_role text,
  ADD COLUMN IF NOT EXISTS secretary_approved_by uuid,
  ADD COLUMN IF NOT EXISTS secretary_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS chairman_approved_by uuid,
  ADD COLUMN IF NOT EXISTS chairman_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 3. Tables FIRST (before functions reference them)
CREATE TABLE IF NOT EXISTS public.expense_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL,
  society_id uuid NOT NULL,
  action text NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_role text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.temporary_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL,
  granted_to_user_id uuid NOT NULL,
  granted_by_user_id uuid NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  notes text,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date NOT NULL,
  is_revoked boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz DEFAULT now()
);

-- 4. Helper functions (now tables exist)
CREATE OR REPLACE FUNCTION public.is_committee_role(_user_id uuid, _society_id uuid, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.committee_members cm
    JOIN public.members m ON m.id = cm.member_id
    WHERE cm.society_id = _society_id
      AND cm.role::text = _role
      AND cm.is_active = true
      AND m.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_committee_role(_user_id uuid, _society_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cm.role::text
  FROM public.committee_members cm
  JOIN public.members m ON m.id = cm.member_id
  WHERE cm.society_id = _society_id
    AND cm.is_active = true
    AND m.user_id = _user_id
  ORDER BY
    CASE cm.role::text
      WHEN 'chairman' THEN 1
      WHEN 'secretary' THEN 2
      WHEN 'treasurer' THEN 3
      ELSE 4
    END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_temp_access(_user_id uuid, _society_id uuid, _resource_type text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.temporary_access_grants
    WHERE granted_to_user_id = _user_id
      AND society_id = _society_id
      AND (resource_type = _resource_type OR resource_type = 'all_financial')
      AND is_revoked = false
      AND CURRENT_DATE BETWEEN valid_from AND valid_to
  )
$$;

-- 5. RLS for new tables
ALTER TABLE public.expense_approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View expense approval history"
  ON public.expense_approval_history FOR SELECT TO authenticated
  USING (is_super_admin() OR has_society_access(society_id));

CREATE POLICY "Insert expense approval history"
  ON public.expense_approval_history FOR INSERT TO authenticated
  WITH CHECK (has_society_access(society_id) AND actor_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_eah_expense ON public.expense_approval_history(expense_id);

ALTER TABLE public.temporary_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Society members view relevant grants"
  ON public.temporary_access_grants FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR has_society_access(society_id)
    OR granted_to_user_id = auth.uid()
  );

CREATE POLICY "Chairman/admin manage grants"
  ON public.temporary_access_grants FOR ALL TO authenticated
  USING (is_super_admin() OR is_society_admin_of(society_id) OR public.is_committee_role(auth.uid(), society_id, 'chairman'))
  WITH CHECK (is_super_admin() OR is_society_admin_of(society_id) OR public.is_committee_role(auth.uid(), society_id, 'chairman'));

CREATE INDEX IF NOT EXISTS idx_tag_user ON public.temporary_access_grants(granted_to_user_id, valid_to);
CREATE INDEX IF NOT EXISTS idx_tag_society ON public.temporary_access_grants(society_id);

-- 6. Trigger to log approval changes
CREATE OR REPLACE FUNCTION public.log_expense_approval_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.approval_status IN ('pending_secretary','pending_chairman') THEN
    INSERT INTO public.expense_approval_history(expense_id, society_id, action, actor_user_id, actor_role, notes)
    VALUES (NEW.id, NEW.society_id, 'submitted', COALESCE(NEW.raised_by_user_id, auth.uid()), NEW.raised_by_role, NEW.description);
  ELSIF TG_OP = 'UPDATE' AND OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    INSERT INTO public.expense_approval_history(expense_id, society_id, action, actor_user_id, actor_role, notes)
    VALUES (
      NEW.id, NEW.society_id,
      CASE NEW.approval_status::text
        WHEN 'pending_chairman' THEN 'approved_secretary'
        WHEN 'approved' THEN 'approved_chairman'
        WHEN 'rejected' THEN 'rejected'
        ELSE NEW.approval_status::text
      END,
      COALESCE(auth.uid(), NEW.secretary_approved_by, NEW.chairman_approved_by, NEW.rejected_by),
      public.get_committee_role(auth.uid(), NEW.society_id),
      NEW.rejection_reason
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_expense_approval ON public.expense_entries;
CREATE TRIGGER trg_log_expense_approval
AFTER INSERT OR UPDATE OF approval_status ON public.expense_entries
FOR EACH ROW EXECUTE FUNCTION public.log_expense_approval_change();

-- 7. Restrictive policy: Treasurer cannot delete approved entries
DROP POLICY IF EXISTS "Treasurer cannot delete approved expenses" ON public.expense_entries;
CREATE POLICY "Treasurer cannot delete approved expenses"
  ON public.expense_entries AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    is_super_admin()
    OR is_society_admin_of(society_id)
    OR NOT (
      public.is_committee_role(auth.uid(), society_id, 'treasurer')
      AND approval_status = 'approved'
    )
  );
