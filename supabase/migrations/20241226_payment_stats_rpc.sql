-- Function to get payment totals by method with new labels
CREATE OR REPLACE FUNCTION public.get_payment_method_stats()
RETURNS TABLE (
    payment_method TEXT,
    total_amount NUMERIC,
    payment_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.payment_method,
        COALESCE(SUM(p.amount), 0) as total_amount,
        COUNT(p.id) as payment_count
    FROM payments p
    GROUP BY p.payment_method;
END;
$$;
