-- Add payment_method column to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'court_collection'));

-- Update record_payment function to accept payment_method
OR REPLACE FUNCTION public.record_payment(
    p_transaction_id uuid,
    p_amount numeric,
    p_payment_date date,
    p_notes text DEFAULT NULL,
    p_payment_method text DEFAULT 'cash'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_balance_before numeric;
    v_balance_after numeric;
    v_customer_id uuid;
BEGIN
    -- Get current balance and customer_id
    SELECT remaining_balance, customer_id INTO v_balance_before, v_customer_id
    FROM transactions
    WHERE id = p_transaction_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found';
    END IF;

    -- Calculate new balance
    v_balance_after := v_balance_before - p_amount;

    -- Insert payment
    INSERT INTO payments (
        transaction_id,
        customer_id,
        amount,
        payment_date,
        notes,
        balance_before,
        balance_after,
        payment_method
    ) VALUES (
        p_transaction_id,
        v_customer_id,
        p_amount,
        p_payment_date,
        p_notes,
        v_balance_before,
        v_balance_after,
        p_payment_method
    );

    -- Update transaction balance
    UPDATE transactions
    SET 
        remaining_balance = v_balance_after,
        status = CASE 
            WHEN v_balance_after <= 0 THEN 'completed'
            ELSE status
        END,
        updated_at = now()
    WHERE id = p_transaction_id;
END;
$$;
