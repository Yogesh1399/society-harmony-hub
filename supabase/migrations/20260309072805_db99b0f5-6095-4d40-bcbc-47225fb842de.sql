
-- 1. Create tenant-documents storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-documents', 'tenant-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload tenant documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tenant-documents');

CREATE POLICY "Users with society access can view tenant documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tenant-documents');

CREATE POLICY "Admins can delete tenant documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tenant-documents');

-- 2. Add columns to tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS rent_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS period_change_reason text;

-- 3. Tenant period history table
CREATE TABLE IF NOT EXISTS public.tenant_period_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  validity_from date NOT NULL,
  validity_to date NOT NULL,
  reason text NOT NULL,
  changed_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.tenant_period_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View tenant history" ON public.tenant_period_history FOR SELECT TO authenticated
USING (tenant_id IN (SELECT t.id FROM public.tenants t WHERE has_society_access(t.society_id)));

CREATE POLICY "Manage tenant history" ON public.tenant_period_history FOR ALL TO authenticated
USING (tenant_id IN (
  SELECT t.id FROM public.tenants t 
  WHERE is_super_admin() OR t.society_id IN (
    SELECT ur.society_id FROM user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
  )
))
WITH CHECK (tenant_id IN (
  SELECT t.id FROM public.tenants t 
  WHERE is_super_admin() OR t.society_id IN (
    SELECT ur.society_id FROM user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role IN ('society_admin', 'committee_member')
  )
));

-- 4. Unique member per flat (partial index for non-null)
DELETE FROM public.members 
WHERE flat_id IS NOT NULL AND id NOT IN (
  SELECT DISTINCT ON (flat_id) id FROM public.members WHERE flat_id IS NOT NULL ORDER BY flat_id, created_at DESC
);
CREATE UNIQUE INDEX IF NOT EXISTS members_flat_id_unique ON public.members (flat_id) WHERE flat_id IS NOT NULL;

-- 5. Notification trigger functions
CREATE OR REPLACE FUNCTION public.notify_on_notice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (society_id, title, message, type, source_type, source_id, created_by)
  VALUES (NEW.society_id, 'New Notice: ' || NEW.title, LEFT(NEW.content, 200), 'notice', 'notice', NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (society_id, title, message, type, source_type, source_id, created_by)
  VALUES (NEW.society_id, 'Payment Recorded', 'Receipt ' || NEW.receipt_number || ' - Amount: ' || NEW.total_amount, 'payment', 'income_entry', NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_complaint_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (society_id, title, message, type, source_type, source_id)
    VALUES (NEW.society_id, 'Complaint Updated: ' || NEW.title, 'Status changed to ' || NEW.status, 'complaint', 'complaint', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_tenant_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_flat_number text;
  v_wing text;
  v_owner_name text;
BEGIN
  SELECT f.flat_number, f.wing INTO v_flat_number, v_wing FROM public.flats f WHERE f.id = NEW.flat_id;
  SELECT m.full_name INTO v_owner_name FROM public.members m WHERE m.flat_id = NEW.flat_id LIMIT 1;
  INSERT INTO public.notifications (society_id, title, message, type, source_type, source_id)
  VALUES (
    NEW.society_id, 'New Tenant Added',
    'Tenant: ' || NEW.full_name || ' | Flat: ' || COALESCE(v_wing || '-', '') || COALESCE(v_flat_number, '') || ' | Owner: ' || COALESCE(v_owner_name, 'N/A') || ' | Period: ' || COALESCE(NEW.validity_from::text, '') || ' to ' || COALESCE(NEW.validity_to::text, ''),
    'tenant', 'tenant', NEW.id
  );
  RETURN NEW;
END;
$$;

-- 6. Create triggers
CREATE TRIGGER trg_notify_notice AFTER INSERT ON public.notices FOR EACH ROW EXECUTE FUNCTION public.notify_on_notice();
CREATE TRIGGER trg_notify_payment AFTER INSERT ON public.income_entries FOR EACH ROW EXECUTE FUNCTION public.notify_on_payment();
CREATE TRIGGER trg_notify_complaint_status AFTER UPDATE ON public.complaints FOR EACH ROW EXECUTE FUNCTION public.notify_on_complaint_status();
CREATE TRIGGER trg_notify_tenant_added AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.notify_on_tenant_added();
