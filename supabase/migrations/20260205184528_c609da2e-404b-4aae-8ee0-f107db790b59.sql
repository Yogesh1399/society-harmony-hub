-- Fix function search path for handle_updated_at and handle_new_user
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_society()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.feature_settings (society_id)
  VALUES (NEW.id);
  
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
$$;