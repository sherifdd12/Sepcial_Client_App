-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('salaries', 'equipment', 'repairs_ink', 'rent_internet', 'other')),
    amount NUMERIC(10,3) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for authenticated users" ON public.expenses
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.expenses
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.expenses
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.expenses
    FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Update get_filtered_dashboard_stats to include expenses
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
    total_legal_fees NUMERIC,
    total_expenses NUMERIC
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
        -- Total Revenue = Payments - Refunds
        ((SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) - 
         (SELECT COALESCE(SUM(amount), 0) FROM public.refunds WHERE refund_date::date BETWEEN filter_start_date AND filter_end_date)) AS total_revenue,
        (SELECT COALESCE(SUM(amount - cost_price), 0) FROM public.transactions WHERE created_at::date BETWEEN filter_start_date AND filter_end_date) AS total_profit,
        ((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE created_at::date <= filter_end_date) + (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active' AND created_at::date <= filter_end_date) - (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date <= filter_end_date) + (SELECT COALESCE(SUM(amount), 0) FROM public.refunds WHERE refund_date::date <= filter_end_date)) AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS overdue_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'tap' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS tap_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'court_collection' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS court_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'other' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS other_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) AS collected_profit,
        (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active' AND created_at::date <= filter_end_date) AS total_legal_fees,
        (SELECT COALESCE(SUM(amount), 0) FROM public.expenses WHERE expense_date BETWEEN filter_start_date AND filter_end_date) AS total_expenses;
END;
$$;
