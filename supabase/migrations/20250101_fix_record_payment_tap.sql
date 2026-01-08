-- Fix record_payment function to support Tap charge IDs and maintain security
-- This restores the p_tap_charge_id parameter and handles duplicate prevention

DROP FUNCTION IF EXISTS public.record_payment(UUID, NUMERIC, DATE, TEXT);
DROP FUNCTION IF EXISTS public.record_payment(UUID, NUMERIC, DATE, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_payment(
    p_transaction_id UUID, 
    p_amount NUMERIC, 
    p_payment_date DATE DEFAULT CURRENT_DATE, 
    p_notes TEXT DEFAULT NULL,
    p_tap_charge_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_id UUID;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
    v_payment_toward_balance NUMERIC;
    v_penalty_amount NUMERIC;
BEGIN
    -- Prevent duplicate processing of the same Tap charge
    IF p_tap_charge_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.payments WHERE tap_charge_id = p_tap_charge_id
    ) THEN
        RETURN;
    END IF;

    SELECT customer_id, remaining_balance INTO v_customer_id, v_balance_before
    FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

    IF p_amount > v_balance_before THEN
        v_payment_toward_balance := v_balance_before;
        v_penalty_amount := p_amount - v_balance_before;
        v_balance_after := 0;
    ELSE
        v_payment_toward_balance := p_amount;
        v_penalty_amount := 0;
        v_balance_after := v_balance_before - p_amount;
    END IF;

    INSERT INTO public.payments(
        transaction_id, 
        customer_id, 
        amount, 
        payment_date, 
        balance_before, 
        balance_after, 
        penalty_amount,
        notes,
        tap_charge_id
    )
    VALUES (
        p_transaction_id, 
        v_customer_id, 
        p_amount, 
        p_payment_date, 
        v_balance_before, 
        v_balance_after, 
        v_penalty_amount,
        p_notes,
        p_tap_charge_id
    );

    UPDATE public.transactions
    SET 
        remaining_balance = v_balance_after,
        status = CASE 
            WHEN v_balance_after <= 0 THEN 'completed' 
            ELSE status 
        END,
        updated_at = NOW()
    WHERE id = p_transaction_id;
END;
$$;
