CREATE OR REPLACE FUNCTION public.get_financial_report(
    start_date DATE,
    end_date DATE,
    transaction_statuses TEXT[]
)
RETURNS TABLE (
    total_item_price NUMERIC,
    total_additional_price NUMERIC,
    total_price NUMERIC,
    total_installment_value NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(t.amount), 0) AS total_item_price,
        COALESCE(SUM(t.extra_price), 0) AS total_additional_price,
        COALESCE(SUM(t.amount + t.extra_price), 0) AS total_price,
        COALESCE(SUM(CASE WHEN t.status = 'ongoing' THEN t.remaining_balance ELSE 0 END), 0) AS total_installment_value
    FROM
        public.transactions t
    WHERE
        t.start_date >= start_date AND t.start_date <= end_date
        AND (cardinality(transaction_statuses) = 0 OR t.status = ANY(transaction_statuses));
END;
$$;
