-- Function to get legal cases with customer financial statistics
CREATE OR REPLACE FUNCTION public.get_legal_cases_with_stats()
RETURNS TABLE (
    id UUID,
    customer_id UUID,
    transaction_id UUID,
    case_number TEXT,
    automated_number TEXT,
    entity TEXT,
    circle_number TEXT,
    opponent TEXT,
    session_date TEXT,
    session_decision TEXT,
    next_session_date TEXT,
    amount_due TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    customer_name TEXT,
    customer_sequence TEXT,
    transaction_sequence TEXT,
    transactions_count BIGINT,
    total_debt NUMERIC,
    total_paid NUMERIC,
    last_payment_date DATE,
    last_payment_amount NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lc.id,
        lc.customer_id,
        lc.transaction_id,
        lc.case_number,
        lc.automated_number,
        lc.entity,
        lc.circle_number,
        lc.opponent,
        lc.session_date,
        lc.session_decision,
        lc.next_session_date,
        lc.amount_due,
        lc.notes,
        lc.created_at,
        lc.updated_at,
        c.full_name as customer_name,
        c.sequence_number::text as customer_sequence,
        t.sequence_number::text as transaction_sequence,
        (SELECT COUNT(*) FROM public.transactions WHERE customer_id = lc.customer_id) as transactions_count,
        (SELECT COALESCE(SUM(remaining_balance), 0) FROM public.transactions WHERE customer_id = lc.customer_id) as total_debt,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE customer_id = lc.customer_id) as total_paid,
        (SELECT MAX(payment_date) FROM public.payments WHERE customer_id = lc.customer_id) as last_payment_date,
        (SELECT p.amount FROM public.payments p WHERE p.customer_id = lc.customer_id ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 1) as last_payment_amount
    FROM public.legal_cases lc
    LEFT JOIN public.customers c ON lc.customer_id = c.id
    LEFT JOIN public.transactions t ON lc.transaction_id = t.id
    ORDER BY lc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_legal_cases_with_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_legal_cases_with_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_legal_cases_with_stats() TO service_role;
