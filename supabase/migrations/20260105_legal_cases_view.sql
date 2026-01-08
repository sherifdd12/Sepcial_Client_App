-- 1. Drop the problematic RPC
DROP FUNCTION IF EXISTS public.get_legal_cases_with_stats();

-- 2. Create a View instead (much more reliable for frontend)
CREATE OR REPLACE VIEW public.legal_cases_with_stats AS
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
    c.sequence_number as customer_sequence,
    t.sequence_number as transaction_sequence,
    (SELECT COUNT(*)::INTEGER FROM public.transactions WHERE customer_id = lc.customer_id) as transactions_count,
    (SELECT COALESCE(SUM(remaining_balance), 0)::NUMERIC FROM public.transactions WHERE customer_id = lc.customer_id) as total_debt,
    (SELECT COALESCE(SUM(amount), 0)::NUMERIC FROM public.payments WHERE customer_id = lc.customer_id) as total_paid,
    (SELECT MAX(payment_date) FROM public.payments WHERE customer_id = lc.customer_id) as last_payment_date,
    (SELECT p.amount FROM public.payments p WHERE p.customer_id = lc.customer_id ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 1) as last_payment_amount
FROM public.legal_cases lc
LEFT JOIN public.customers c ON lc.customer_id = c.id
LEFT JOIN public.transactions t ON lc.transaction_id = t.id;

-- 3. Grant permissions on the view
GRANT SELECT ON public.legal_cases_with_stats TO authenticated;
GRANT SELECT ON public.legal_cases_with_stats TO anon;
GRANT SELECT ON public.legal_cases_with_stats TO service_role;
