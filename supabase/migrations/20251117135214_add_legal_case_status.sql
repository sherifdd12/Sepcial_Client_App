ALTER TABLE public.transactions
ADD COLUMN legal_case_status TEXT;

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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.customers) AS total_customers,
        (SELECT COUNT(*) FROM public.transactions WHERE (status = 'active' OR status = 'overdue') AND legal_case_status IS NULL) AS total_active_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.transactions) AS total_revenue,
        (SELECT COALESCE(SUM(profit), 0) FROM public.transactions) AS total_profit,
        (SELECT COALESCE(SUM(remaining_balance), 0) FROM public.transactions WHERE (status = 'active' OR status = 'overdue') AND legal_case_status IS NULL) AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue' AND legal_case_status IS NULL) AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue' AND legal_case_status IS NULL) AS overdue_transactions;
END;
$$;
