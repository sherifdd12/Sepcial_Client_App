-- 1. Update record_payment function to automatically apply excess to legal fees
CREATE OR REPLACE FUNCTION public.record_payment(
    p_transaction_id UUID, 
    p_amount NUMERIC, 
    p_payment_date DATE DEFAULT CURRENT_DATE, 
    p_notes TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'other',
    p_tap_charge_id TEXT DEFAULT NULL,
    p_legal_case_id UUID DEFAULT NULL,
    p_legal_fee_id UUID DEFAULT NULL
)
RETURNS UUID
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
    v_payment_id UUID;
BEGIN
    -- Prevent duplicate processing of the same Tap charge
    IF p_tap_charge_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.payments WHERE tap_charge_id = p_tap_charge_id
    ) THEN
        SELECT id INTO v_payment_id FROM public.payments WHERE tap_charge_id = p_tap_charge_id;
        RETURN v_payment_id;
    END IF;

    SELECT customer_id, remaining_balance INTO v_customer_id, v_balance_before
    FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found';
    END IF;

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
        payment_method,
        tap_charge_id,
        legal_case_id,
        legal_fee_id
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
        p_payment_method,
        p_tap_charge_id,
        p_legal_case_id,
        p_legal_fee_id
    )
    RETURNING id INTO v_payment_id;

    UPDATE public.transactions
    SET 
        remaining_balance = v_balance_after,
        status = CASE 
            WHEN v_balance_after <= 0 THEN 'completed' 
            ELSE status 
        END,
        updated_at = NOW()
    WHERE id = p_transaction_id;

    -- AUTO-APPLY TO LEGAL FEES:
    -- If there is a specific legal fee provided, mark it as paid
    IF p_legal_fee_id IS NOT NULL THEN
        UPDATE public.legal_fees
        SET status = 'paid', updated_at = NOW()
        WHERE id = p_legal_fee_id;
    -- ELSE if there is an overpayment (penalty_amount > 0), mark ALL active legal fees for this customer as paid
    ELSIF v_penalty_amount > 0 THEN
        UPDATE public.legal_fees
        SET status = 'paid', updated_at = NOW()
        WHERE customer_id = v_customer_id AND status = 'active';
    END IF;

    RETURN v_payment_id;
END;
$$;

-- 2. One-time script to fix existing overpaid customers
-- This marks active legal fees as 'paid' for any customer who currently has an excess balance
DO $$
DECLARE
    r RECORD;
    v_excess NUMERIC;
BEGIN
    FOR r IN SELECT id FROM public.customers LOOP
        -- Using the previously created get_customer_balance function
        v_excess := public.get_customer_balance(r.id);
        
        IF v_excess > 0 THEN
            UPDATE public.legal_fees
            SET status = 'paid', updated_at = NOW()
            WHERE customer_id = r.id AND status = 'active';
        END IF;
    END LOOP;
END $$;
