-- Fix the record_payment function to prevent negative balance
CREATE OR REPLACE FUNCTION public.record_payment(
    p_transaction_id uuid,
    p_amount numeric,
    p_payment_date date,
    p_notes text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_customer_id UUID;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
BEGIN
    SELECT customer_id, remaining_balance INTO v_customer_id, v_balance_before
    FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

    v_balance_after := GREATEST(0, v_balance_before - p_amount);

    INSERT INTO public.payments(transaction_id, customer_id, amount, payment_date, balance_before, balance_after, notes)
    VALUES (p_transaction_id, v_customer_id, p_amount, p_payment_date, v_balance_before, v_balance_after, p_notes);

    UPDATE public.transactions
    SET remaining_balance = v_balance_after,
        status = CASE WHEN v_balance_after <= 0 THEN 'completed' ELSE status END
    WHERE id = p_transaction_id;
END;
$function$;

-- Add payment_id column to document_attachments table
ALTER TABLE public.document_attachments
ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_document_attachments_payment_id ON public.document_attachments(payment_id);
CREATE INDEX IF NOT EXISTS idx_document_attachments_customer_id ON public.document_attachments(customer_id);
CREATE INDEX IF NOT EXISTS idx_document_attachments_transaction_id ON public.document_attachments(transaction_id);

-- Create settings table for cloud storage configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key text NOT NULL UNIQUE,
    setting_value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings" ON public.app_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));