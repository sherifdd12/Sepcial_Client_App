-- Add payment_method column to payments table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payment_method') THEN
        ALTER TABLE public.payments ADD COLUMN payment_method TEXT DEFAULT 'tap';
    END IF;
END $$;

-- Update the check constraint for payment_method
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('tap', 'other', 'court_collection'));

-- Update record_payment function to return the payment ID and accept new methods
CREATE OR REPLACE FUNCTION public.record_payment(
    p_transaction_id uuid,
    p_amount numeric,
    p_payment_date date,
    p_notes text DEFAULT NULL,
    p_payment_method text DEFAULT 'tap',
    p_tap_charge_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_balance_before numeric;
    v_balance_after numeric;
    v_customer_id uuid;
    v_payment_id uuid;
BEGIN
    -- Prevent duplicate processing of the same Tap charge
    IF p_tap_charge_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.payments WHERE tap_charge_id = p_tap_charge_id
    ) THEN
        SELECT id INTO v_payment_id FROM public.payments WHERE tap_charge_id = p_tap_charge_id;
        RETURN v_payment_id;
    END IF;

    -- Get current balance and customer_id
    SELECT remaining_balance, customer_id INTO v_balance_before, v_customer_id
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

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
        payment_method,
        tap_charge_id
    ) VALUES (
        p_transaction_id,
        v_customer_id,
        p_amount,
        p_payment_date,
        p_notes,
        v_balance_before,
        v_balance_after,
        p_payment_method,
        p_tap_charge_id
    )
    RETURNING id INTO v_payment_id;

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

    RETURN v_payment_id;
END;
$$;
