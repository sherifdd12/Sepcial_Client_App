-- Tap Payments Integration Schema (Updated for Governance)
BEGIN;

-- 1. Add tap_charge_id to payments to prevent duplicate processing
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS tap_charge_id TEXT UNIQUE;

-- 2. Create status enum for Tap logs if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.tap_log_status AS ENUM ('pending', 'confirmed', 'rejected', 'unmatched');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create a table for logging Tap webhooks with matching info
CREATE TABLE IF NOT EXISTS public.tap_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charge_id TEXT UNIQUE,
    status public.tap_log_status DEFAULT 'pending',
    amount NUMERIC(10,3),
    currency TEXT,
    reference_no TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    payload JSONB,
    
    -- Matching info
    matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    matched_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES auth.users(id),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Update record_payment to handle tap_charge_id (already done but keeping for completeness)
CREATE OR REPLACE FUNCTION public.record_payment(
    p_transaction_id UUID, 
    p_amount NUMERIC, 
    p_payment_date DATE, 
    p_notes TEXT DEFAULT NULL,
    p_tap_charge_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_customer_id UUID;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
BEGIN
    -- Prevent duplicate processing of the same Tap charge
    IF p_tap_charge_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.payments WHERE tap_charge_id = p_tap_charge_id
    ) THEN
        RETURN;
    END IF;

    SELECT customer_id, remaining_balance INTO v_customer_id, v_balance_before
    FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

    v_balance_after := v_balance_before - p_amount;

    INSERT INTO public.payments(
        transaction_id, 
        customer_id, 
        amount, 
        payment_date, 
        balance_before, 
        balance_after, 
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
        p_notes,
        p_tap_charge_id
    );

    UPDATE public.transactions
    SET remaining_balance = v_balance_after,
        status = CASE WHEN v_balance_after <= 0 THEN 'completed' ELSE status END
    WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Enable RLS on the logs table
ALTER TABLE public.tap_webhook_logs ENABLE ROW LEVEL SECURITY;

-- 6. Only admins can view and manage logs
DROP POLICY IF EXISTS "Admins can manage tap webhook logs" ON public.tap_webhook_logs;
CREATE POLICY "Admins can manage tap webhook logs" 
    ON public.tap_webhook_logs FOR ALL 
    TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMIT;
