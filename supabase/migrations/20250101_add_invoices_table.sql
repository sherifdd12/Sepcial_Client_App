-- Create the invoices table to track Tap payments
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tap_id TEXT UNIQUE,          -- The ID provided by Tap (inv_xxx or chg_xxx)
    amount NUMERIC(10, 3),       -- Tap uses 3 decimal places for KWD/BHD
    currency TEXT DEFAULT 'KWD',
    status TEXT DEFAULT 'INITIATED', 
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for the invoices table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'invoices'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    END IF;
END $$;

-- Add RLS policies for invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
CREATE POLICY "Admins can manage all invoices" 
    ON public.invoices FOR ALL 
    TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Staff can view all invoices" ON public.invoices;
CREATE POLICY "Staff can view all invoices" 
    ON public.invoices FOR SELECT 
    TO authenticated 
    USING (public.has_role(auth.uid(), 'staff'));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
