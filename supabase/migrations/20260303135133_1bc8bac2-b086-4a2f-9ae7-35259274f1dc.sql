
-- Notifications table for system notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  source_type text,
  source_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  target_roles text[] DEFAULT '{}'::text[],
  target_user_ids uuid[] DEFAULT '{}'::uuid[]
);

-- Notification reads tracking
CREATE TABLE public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Notice reads tracking
CREATE TABLE public.notice_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz DEFAULT now(),
  UNIQUE(notice_id, user_id)
);

-- Notification settings per society
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE UNIQUE,
  notify_payment_to_admin boolean DEFAULT true,
  notify_notice_to_all boolean DEFAULT true,
  notify_complaint_to_admin boolean DEFAULT true,
  notify_complaint_update_to_member boolean DEFAULT true,
  enabled_channels text[] DEFAULT '{in_app}'::text[],
  updated_at timestamptz DEFAULT now()
);

-- RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view notifications in their society" ON public.notifications FOR SELECT USING (has_society_access(society_id));
CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL USING (is_super_admin() OR has_society_access(society_id)) WITH CHECK (is_super_admin() OR has_society_access(society_id));

-- RLS for notification_reads
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notification reads" ON public.notification_reads FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all notification reads" ON public.notification_reads FOR SELECT USING (
  notification_id IN (SELECT id FROM public.notifications WHERE is_super_admin() OR has_society_access(society_id))
);

-- RLS for notice_reads
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notice reads" ON public.notice_reads FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all notice reads" ON public.notice_reads FOR SELECT USING (
  notice_id IN (SELECT id FROM public.notices WHERE is_super_admin() OR has_society_access(society_id))
);

-- RLS for notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view notification settings" ON public.notification_settings FOR SELECT USING (has_society_access(society_id));
CREATE POLICY "Admins can manage notification settings" ON public.notification_settings FOR ALL USING (is_super_admin() OR is_society_admin_of(society_id)) WITH CHECK (is_super_admin() OR is_society_admin_of(society_id));

-- Update handle_new_society to add notification_settings
CREATE OR REPLACE FUNCTION public.handle_new_society()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.feature_settings (society_id) VALUES (NEW.id);
  INSERT INTO public.notification_settings (society_id) VALUES (NEW.id);
  
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
  
  RETURN NEW;
END;
$function$;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
