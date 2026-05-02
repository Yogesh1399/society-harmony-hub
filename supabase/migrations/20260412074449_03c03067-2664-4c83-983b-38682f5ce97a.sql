
-- Create fiscal year status enum
CREATE TYPE public.fiscal_year_status AS ENUM ('open', 'closed', 'finalized');

-- Create fiscal month status enum  
CREATE TYPE public.fiscal_month_status AS ENUM ('open', 'closed');

-- Create fiscal_years table
CREATE TABLE public.fiscal_years (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  year_code text NOT NULL, -- e.g. "2526" for 2025-26
  year_label text NOT NULL, -- e.g. "2025-26"
  start_date date NOT NULL,
  end_date date NOT NULL,
  status public.fiscal_year_status NOT NULL DEFAULT 'open',
  audit_document_url text,
  finalized_at timestamptz,
  finalized_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(society_id, year_code)
);

ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fiscal years"
  ON public.fiscal_years FOR ALL TO authenticated
  USING (is_super_admin() OR is_society_admin_of(society_id))
  WITH CHECK (is_super_admin() OR is_society_admin_of(society_id));

CREATE POLICY "Users can view fiscal years"
  ON public.fiscal_years FOR SELECT TO authenticated
  USING (has_society_access(society_id));

-- Create fiscal_months table
CREATE TABLE public.fiscal_months (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fiscal_year_id uuid NOT NULL REFERENCES public.fiscal_years(id) ON DELETE CASCADE,
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  month_number int NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  month_label text NOT NULL, -- e.g. "Apr 2025"
  month_start date NOT NULL,
  month_end date NOT NULL,
  status public.fiscal_month_status NOT NULL DEFAULT 'open',
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(fiscal_year_id, month_number)
);

ALTER TABLE public.fiscal_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fiscal months"
  ON public.fiscal_months FOR ALL TO authenticated
  USING (is_super_admin() OR is_society_admin_of(society_id))
  WITH CHECK (is_super_admin() OR is_society_admin_of(society_id));

CREATE POLICY "Treasurer can manage fiscal months"
  ON public.fiscal_months FOR ALL TO authenticated
  USING (has_society_access(society_id))
  WITH CHECK (has_society_access(society_id));

CREATE POLICY "Users can view fiscal months"
  ON public.fiscal_months FOR SELECT TO authenticated
  USING (has_society_access(society_id));

-- Create document_series table
CREATE TABLE public.document_series (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  fiscal_year_id uuid NOT NULL REFERENCES public.fiscal_years(id) ON DELETE CASCADE,
  doc_type text NOT NULL, -- maintenance, income, expense, notice, complaint, etc.
  type_code text NOT NULL, -- MNT, RCP, VCH, NTC, etc.
  prefix text, -- optional extra prefix
  format_pattern text NOT NULL DEFAULT '{YEAR}-{TYPE}-{NUM}', -- e.g. 2526-MNT-00001
  current_number int NOT NULL DEFAULT 0,
  pad_length int NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(society_id, fiscal_year_id, doc_type)
);

ALTER TABLE public.document_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage document series"
  ON public.document_series FOR ALL TO authenticated
  USING (is_super_admin() OR is_society_admin_of(society_id))
  WITH CHECK (is_super_admin() OR is_society_admin_of(society_id));

CREATE POLICY "Users can view document series"
  ON public.document_series FOR SELECT TO authenticated
  USING (has_society_access(society_id));

-- Add document_number_format to societies for global format preference
ALTER TABLE public.societies ADD COLUMN IF NOT EXISTS document_number_format text DEFAULT '{YEAR}-{TYPE}-{NUM}';

-- Add auto_close_month_day to societies (day of next month when prev month auto-closes)
ALTER TABLE public.societies ADD COLUMN IF NOT EXISTS auto_close_month_day int;

-- Function to generate next document number
CREATE OR REPLACE FUNCTION public.generate_next_doc_number(
  _society_id uuid,
  _doc_type text,
  _fiscal_year_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series document_series%ROWTYPE;
  v_next_num int;
  v_result text;
  v_fy_id uuid;
BEGIN
  -- Get active fiscal year if not provided
  IF _fiscal_year_id IS NULL THEN
    SELECT id INTO v_fy_id FROM fiscal_years
    WHERE society_id = _society_id AND status = 'open'
    ORDER BY start_date DESC LIMIT 1;
  ELSE
    v_fy_id := _fiscal_year_id;
  END IF;

  IF v_fy_id IS NULL THEN
    RAISE EXCEPTION 'No open fiscal year found for this society';
  END IF;

  -- Lock and increment
  UPDATE document_series
  SET current_number = current_number + 1, updated_at = now()
  WHERE society_id = _society_id AND fiscal_year_id = v_fy_id AND doc_type = _doc_type
  RETURNING * INTO v_series;

  IF v_series IS NULL THEN
    RAISE EXCEPTION 'No document series found for type % in fiscal year', _doc_type;
  END IF;

  v_next_num := v_series.current_number;

  -- Build formatted number
  v_result := v_series.format_pattern;
  v_result := replace(v_result, '{YEAR}', (SELECT year_code FROM fiscal_years WHERE id = v_fy_id));
  v_result := replace(v_result, '{TYPE}', v_series.type_code);
  v_result := replace(v_result, '{NUM}', lpad(v_next_num::text, v_series.pad_length, '0'));
  IF v_series.prefix IS NOT NULL AND v_series.prefix != '' THEN
    v_result := replace(v_result, '{PREFIX}', v_series.prefix);
  END IF;

  RETURN v_result;
END;
$$;

-- Function to check if a date falls in a closed/finalized period
CREATE OR REPLACE FUNCTION public.is_period_locked(
  _society_id uuid,
  _date date
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_status fiscal_month_status;
  v_year_status fiscal_year_status;
BEGIN
  -- Check fiscal year status
  SELECT fy.status INTO v_year_status
  FROM fiscal_years fy
  WHERE fy.society_id = _society_id
    AND _date BETWEEN fy.start_date AND fy.end_date
  LIMIT 1;

  IF v_year_status = 'finalized' THEN
    RETURN true;
  END IF;

  -- Check fiscal month status
  SELECT fm.status INTO v_month_status
  FROM fiscal_months fm
  WHERE fm.society_id = _society_id
    AND _date BETWEEN fm.month_start AND fm.month_end
  LIMIT 1;

  IF v_month_status = 'closed' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Update handle_new_society to create fiscal year and document series
CREATE OR REPLACE FUNCTION public.handle_new_society()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_fy_id uuid;
  v_current_year int;
  v_start_year int;
  v_end_year int;
  v_year_code text;
  v_year_label text;
  v_start_date date;
  v_end_date date;
  v_month_date date;
  v_format text;
  i int;
BEGIN
  -- Existing defaults
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

  -- Determine current fiscal year (Apr-Mar)
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
    v_start_year := v_current_year;
    v_end_year := v_current_year + 1;
  ELSE
    v_start_year := v_current_year - 1;
    v_end_year := v_current_year;
  END IF;

  v_year_code := right(v_start_year::text, 2) || right(v_end_year::text, 2);
  v_year_label := v_start_year::text || '-' || right(v_end_year::text, 2);
  v_start_date := make_date(v_start_year, 4, 1);
  v_end_date := make_date(v_end_year, 3, 31);
  v_format := COALESCE(NEW.document_number_format, '{YEAR}-{TYPE}-{NUM}');

  -- Create fiscal year
  INSERT INTO public.fiscal_years (society_id, year_code, year_label, start_date, end_date)
  VALUES (NEW.id, v_year_code, v_year_label, v_start_date, v_end_date)
  RETURNING id INTO v_fy_id;

  -- Create 12 fiscal months (Apr to Mar)
  FOR i IN 0..11 LOOP
    v_month_date := v_start_date + (i || ' months')::interval;
    INSERT INTO public.fiscal_months (fiscal_year_id, society_id, month_number, month_label, month_start, month_end)
    VALUES (
      v_fy_id, NEW.id, i + 1,
      to_char(v_month_date, 'Mon YYYY'),
      date_trunc('month', v_month_date)::date,
      (date_trunc('month', v_month_date) + interval '1 month' - interval '1 day')::date
    );
  END LOOP;

  -- Create document series for all doc types
  INSERT INTO public.document_series (society_id, fiscal_year_id, doc_type, type_code, format_pattern) VALUES
    (NEW.id, v_fy_id, 'income', 'RCP', v_format),
    (NEW.id, v_fy_id, 'expense', 'VCH', v_format),
    (NEW.id, v_fy_id, 'maintenance', 'MNT', v_format),
    (NEW.id, v_fy_id, 'notice', 'NTC', v_format),
    (NEW.id, v_fy_id, 'complaint', 'CMP', v_format),
    (NEW.id, v_fy_id, 'debit_note', 'DBN', v_format),
    (NEW.id, v_fy_id, 'credit_note', 'CRN', v_format);

  -- Keep legacy receipt_series for backward compatibility
  INSERT INTO public.receipt_series (society_id, receipt_type, financial_year, prefix) VALUES
    (NEW.id, 'income', v_year_label, 'RCP'),
    (NEW.id, 'expense', v_year_label, 'VCH');
  
  RETURN NEW;
END;
$function$;

-- Add triggers for updated_at
CREATE TRIGGER update_fiscal_years_updated_at
  BEFORE UPDATE ON public.fiscal_years
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_document_series_updated_at
  BEFORE UPDATE ON public.document_series
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
