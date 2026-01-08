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
    collected_profit NUMERIC
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
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) AS collected_profit;
END;
$$;
