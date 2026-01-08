-- Create legal_fees table
CREATE TABLE IF NOT EXISTS public.legal_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'paid', 'refunded'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add legal_case_id and legal_fee_id to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS legal_case_id UUID REFERENCES public.legal_cases(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS legal_fee_id UUID REFERENCES public.legal_fees(id) ON DELETE SET NULL;

-- Enable RLS for legal_fees
ALTER TABLE public.legal_fees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.legal_fees;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.legal_fees;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.legal_fees;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.legal_fees;

-- Create policies
CREATE POLICY "Enable read access for authenticated users" ON public.legal_fees
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.legal_fees
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.legal_fees
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.legal_fees
    FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_legal_fees_updated_at ON public.legal_fees;
CREATE TRIGGER update_legal_fees_updated_at
    BEFORE UPDATE ON public.legal_fees
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Update get_dashboard_stats
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
    total_customers BIGINT,
    total_active_transactions BIGINT,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    total_outstanding NUMERIC,
    total_overdue NUMERIC,
    overdue_transactions BIGINT,
    total_legal_fees NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.customers) AS total_customers,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'active' OR status = 'overdue') AS total_active_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments) AS total_revenue,
        (SELECT COALESCE(SUM(t.amount), 0) - COALESCE(SUM(t.cost_price), 0) FROM public.transactions t) AS total_profit,
        ((SELECT COALESCE(SUM(amount), 0) FROM public.transactions) + (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active') - (SELECT COALESCE(SUM(amount), 0) FROM public.payments)) AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue') AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue') AS overdue_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active') AS total_legal_fees;
END;
$$;

-- Update get_filtered_dashboard_stats
DROP FUNCTION IF EXISTS public.get_filtered_dashboard_stats(int, int);
CREATE OR REPLACE FUNCTION public.get_filtered_dashboard_stats(p_year int DEFAULT 0, p_month int DEFAULT 0)
RETURNS TABLE (
    total_customers BIGINT,
    total_active_transactions BIGINT,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    total_outstanding NUMERIC,
    total_overdue NUMERIC,
    overdue_transactions BIGINT,
    tap_revenue NUMERIC,
    court_revenue NUMERIC,
    other_revenue NUMERIC,
    collected_profit NUMERIC,
    total_legal_fees NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    filter_start_date DATE;
    filter_end_date DATE;
BEGIN
    IF p_year > 0 THEN
        IF p_month > 0 THEN
            filter_start_date := make_date(p_year, p_month, 1);
            filter_end_date := (filter_start_date + interval '1 month' - interval '1 day')::date;
        ELSE
            filter_start_date := make_date(p_year, 1, 1);
            filter_end_date := make_date(p_year, 12, 31);
        END IF;
    ELSE
        filter_start_date := '1900-01-01'::date;
        filter_end_date := '2100-12-31'::date;
    END IF;

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.customers WHERE created_at::date <= filter_end_date) AS total_customers,
        (SELECT COUNT(*) FROM public.transactions WHERE created_at::date <= filter_end_date AND (status = 'active' OR status = 'overdue')) AS total_active_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) AS total_revenue,
        (SELECT COALESCE(SUM(amount - cost_price), 0) FROM public.transactions WHERE created_at::date BETWEEN filter_start_date AND filter_end_date) AS total_profit,
        ((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE created_at::date <= filter_end_date) + (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active' AND created_at::date <= filter_end_date) - (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date <= filter_end_date)) AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS overdue_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'tap' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS tap_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'court_collection' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS court_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'other' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS other_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) AS collected_profit,
        (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active' AND created_at::date <= filter_end_date) AS total_legal_fees;
END;
$$;
