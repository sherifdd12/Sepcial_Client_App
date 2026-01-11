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

-- Enable RLS
ALTER TABLE public.legal_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON public.legal_fees
    FOR ALL USING (auth.role() = 'authenticated');

-- Create customer_balance_adjustments table
CREATE TABLE IF NOT EXISTS public.customer_balance_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(10,3) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('refund', 'legal_fees')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.customer_balance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON public.customer_balance_adjustments
    FOR ALL USING (auth.role() = 'authenticated');

-- Function to calculate customer balance (overpayment/debt)
CREATE OR REPLACE FUNCTION public.get_customer_receivable_balance(p_customer_id UUID)
RETURNS NUMERIC(10,3)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_payments NUMERIC(10,3);
    v_total_transaction_amount NUMERIC(10,3);
    v_total_adjustments NUMERIC(10,3);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_payments FROM public.payments WHERE customer_id = p_customer_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_transaction_amount FROM public.transactions WHERE customer_id = p_customer_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_total_adjustments FROM public.customer_balance_adjustments WHERE customer_id = p_customer_id;
    RETURN v_total_payments - v_total_transaction_amount - v_total_adjustments;
END;
$$;

-- Fix dashboard stats
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
    total_customer_receivables NUMERIC,
    total_refunds NUMERIC,
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
        ((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE created_at::date <= filter_end_date) - 
         (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date <= filter_end_date)) AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS overdue_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'tap' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS tap_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'court_collection' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS court_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'other' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS other_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) AS collected_profit,
        (SELECT COALESCE(SUM(balance), 0) FROM (
            SELECT public.get_customer_receivable_balance(id) as balance
            FROM public.customers
        ) as balances WHERE balance > 0) AS total_customer_receivables,
        (SELECT COALESCE(SUM(amount), 0) FROM public.customer_balance_adjustments WHERE type = 'refund' AND created_at::date BETWEEN filter_start_date AND filter_end_date) AS total_refunds,
        (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'paid' AND created_at::date BETWEEN filter_start_date AND filter_end_date) AS total_legal_fees;
END;
$$;

-- Function to get customers with excess balance
CREATE OR REPLACE FUNCTION public.get_customers_with_excess_balance()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    mobile_number TEXT,
    balance NUMERIC(10,3)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        SELECT 
            c.id,
            c.full_name,
            c.mobile_number,
            public.get_customer_receivable_balance(c.id) as balance
        FROM public.customers c
    ) sub
    WHERE sub.balance > 0
    ORDER BY sub.balance DESC;
END;
$$;
