-- Create legal_cases table
CREATE TABLE IF NOT EXISTS public.legal_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    case_number TEXT NOT NULL,
    automated_number TEXT,
    entity TEXT,
    circle_number TEXT,
    opponent TEXT,
    session_date TEXT,
    session_decision TEXT,
    next_session_date TEXT,
    amount_due TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.legal_cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.legal_cases;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.legal_cases;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.legal_cases;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.legal_cases;

-- Create policies
CREATE POLICY "Enable read access for authenticated users" ON public.legal_cases
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.legal_cases
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.legal_cases
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.legal_cases
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create index for faster searching
-- Using DROP INDEX IF EXISTS to ensure we can change it to UNIQUE if needed
DROP INDEX IF EXISTS idx_legal_cases_case_number;
CREATE UNIQUE INDEX idx_legal_cases_case_number ON public.legal_cases(case_number);

CREATE INDEX IF NOT EXISTS idx_legal_cases_customer_id ON public.legal_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_transaction_id ON public.legal_cases(transaction_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS update_legal_cases_updated_at ON public.legal_cases;
CREATE TRIGGER update_legal_cases_updated_at
    BEFORE UPDATE ON public.legal_cases
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
