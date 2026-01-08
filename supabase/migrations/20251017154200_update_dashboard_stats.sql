-- Update the get_dashboard_stats function to use the new calculation logic
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
    total_customers BIGINT,
    total_active_transactions BIGINT,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    total_outstanding NUMERIC,
    total_overdue NUMERIC,
    overdue_transactions BIGINT
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
        ((SELECT COALESCE(SUM(amount), 0) FROM public.transactions) - (SELECT COALESCE(SUM(amount), 0) FROM public.payments)) AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue') AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue') AS overdue_transactions;
END;
$$;