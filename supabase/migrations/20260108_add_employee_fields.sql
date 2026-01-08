-- Add new fields to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS civil_id TEXT,
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS residency_expiry DATE;

-- Add comment for documentation
COMMENT ON COLUMN public.employees.civil_id IS 'الرقم المدني';
COMMENT ON COLUMN public.employees.passport_number IS 'رقم الجواز';
COMMENT ON COLUMN public.employees.residency_expiry IS 'تاريخ انتهاء الإقامة';
