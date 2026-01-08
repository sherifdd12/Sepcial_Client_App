-- Fix get_dashboard_stats to calculate revenue from payments (actual money collected)
-- and fix the high_risk_customers function

DROP FUNCTION IF EXISTS public.get_dashboard_stats();

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(
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
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.customers) AS total_customers,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'active' OR status = 'overdue') AS total_active_transactions,
        -- Revenue is the actual money collected (sum of payments)
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments) AS total_revenue,
        -- Profit is total transaction amount minus cost price
        (SELECT COALESCE(SUM(profit), 0) FROM public.transactions) AS total_profit,
        (SELECT COALESCE(SUM(remaining_balance), 0) FROM public.transactions WHERE status = 'active' OR status = 'overdue') AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue') AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue') AS overdue_transactions;
END;
$$;

-- Fix get_high_risk_customers to show correct overdue amounts
DROP FUNCTION IF EXISTS public.get_high_risk_customers();

CREATE OR REPLACE FUNCTION public.get_high_risk_customers()
RETURNS TABLE(
    customer_id UUID,
    full_name TEXT,
    mobile_number TEXT,
    risk_reason TEXT,
    total_outstanding NUMERIC,
    total_overdue_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    WITH customer_stats AS (
        SELECT
            c.id,
            c.full_name,
            c.mobile_number,
            SUM(t.remaining_balance) as total_outstanding,
            -- Overdue amount should not exceed remaining balance
            SUM(LEAST(COALESCE(t.overdue_amount, 0), t.remaining_balance)) as total_overdue_amount,
            MAX(COALESCE(t.overdue_installments, 0)) as max_overdue_installments
        FROM public.customers c
        JOIN public.transactions t ON c.id = t.customer_id
        WHERE t.remaining_balance > 0
        GROUP BY c.id
    )
    SELECT
        cs.id as customer_id,
        cs.full_name,
        cs.mobile_number,
        CASE
            WHEN cs.max_overdue_installments >= 3 THEN 'تأخر كبير في السداد'
            WHEN cs.total_outstanding > 5000 THEN 'رصيد متبقي مرتفع جدا'
            WHEN cs.total_overdue_amount > 1000 THEN 'مبلغ متأخر مرتفع'
            ELSE 'مخاطر متعددة'
        END as risk_reason,
        cs.total_outstanding,
        cs.total_overdue_amount
    FROM customer_stats cs
    WHERE cs.total_overdue_amount > 0 OR cs.max_overdue_installments > 1
    ORDER BY cs.total_overdue_amount DESC, cs.total_outstanding DESC
    LIMIT 10;
END;
$$;