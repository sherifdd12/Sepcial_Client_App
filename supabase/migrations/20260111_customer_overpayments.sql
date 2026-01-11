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

-- Enable RLS
ALTER TABLE public.customer_balance_adjustments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage adjustments" 
ON public.customer_balance_adjustments FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view adjustments" 
ON public.customer_balance_adjustments FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'staff'));

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
    -- Sum of all payments
    SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
    FROM public.payments
    WHERE customer_id = p_customer_id;

    -- Sum of all transaction amounts (إجمالي السعر)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_transaction_amount
    FROM public.transactions
    WHERE customer_id = p_customer_id;

    -- Sum of all adjustments (refunds and legal fees)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_adjustments
    FROM public.customer_balance_adjustments
    WHERE customer_id = p_customer_id;

    -- Balance = Payments - Transactions - Adjustments
    -- Positive means customer has extra money (receivables)
    -- Negative means customer still owes money
    RETURN v_total_payments - v_total_transaction_amount - v_total_adjustments;
END;
$$;

-- Update get_dashboard_stats to include total receivables
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
    total_customers BIGINT,
    total_active_transactions BIGINT,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    total_outstanding NUMERIC,
    total_overdue NUMERIC,
    overdue_transactions BIGINT,
    total_customer_receivables NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_total_receivables NUMERIC := 0;
BEGIN
    -- Calculate total receivables (sum of all positive balances)
    SELECT SUM(balance) INTO v_total_receivables
    FROM (
        SELECT public.get_customer_receivable_balance(id) as balance
        FROM public.customers
    ) as balances
    WHERE balance > 0;

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.customers) AS total_customers,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'active' OR status = 'overdue') AS total_active_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.transactions) AS total_revenue,
        (SELECT COALESCE(SUM(profit), 0) FROM public.transactions) AS total_profit,
        (SELECT COALESCE(SUM(remaining_balance), 0) FROM public.transactions WHERE status = 'active' OR status = 'overdue') AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue') AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue') AS overdue_transactions,
        COALESCE(v_total_receivables, 0) AS total_customer_receivables;
END;
$$;

-- Drop the function first to allow changing the return type
DROP FUNCTION IF EXISTS public.get_filtered_dashboard_stats(int, int);

-- Create a new RPC function for filtered dashboard statistics
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
    total_customer_receivables NUMERIC
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
    -- Calculate date range
    -- If p_year is 0, we look at all time
    -- If p_month is 0, we look at the whole year
    
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
        -- Total customers created up to filter_end_date
        (SELECT COUNT(*) FROM public.customers WHERE created_at::date <= filter_end_date) AS total_customers,
        
        -- Active transactions created up to filter_end_date
        (SELECT COUNT(*) FROM public.transactions WHERE created_at::date <= filter_end_date AND (status = 'active' OR status = 'overdue')) AS total_active_transactions,
        
        -- Revenue: Sum of payments in the period
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) AS total_revenue,
        
        -- Profit: Total profit from transactions created in the period
        (SELECT COALESCE(SUM(amount - cost_price), 0) FROM public.transactions WHERE created_at::date BETWEEN filter_start_date AND filter_end_date) AS total_profit,
        
        -- Outstanding: Current total outstanding (as of end of period)
        ((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE created_at::date <= filter_end_date) - 
         (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date <= filter_end_date)) AS total_outstanding,
        
        -- Overdue: Current total overdue
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS total_overdue,
        
        -- Overdue count
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS overdue_transactions,
        
        -- Method specific revenue in period
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'tap' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS tap_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'court_collection' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS court_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'other' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS other_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) AS collected_profit,
        (SELECT COALESCE(SUM(balance), 0) FROM (
            SELECT public.get_customer_receivable_balance(id) as balance
            FROM public.customers
        ) as balances WHERE balance > 0) AS total_customer_receivables;
END;
$$;
