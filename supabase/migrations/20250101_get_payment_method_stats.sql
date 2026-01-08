DROP FUNCTION IF EXISTS get_payment_method_stats();
CREATE OR REPLACE FUNCTION get_payment_method_stats()
RETURNS TABLE (
  payment_method text,
  total_amount numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.payment_method,
    COALESCE(SUM(p.amount), 0) as total_amount
  FROM
    payments p
  GROUP BY
    p.payment_method;
END;
$$;
