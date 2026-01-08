-- Create function to update transaction when payment is deleted
CREATE OR REPLACE FUNCTION public.update_transaction_on_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Add the deleted payment amount back to the transaction's remaining balance
    UPDATE public.transactions
    SET 
        remaining_balance = remaining_balance + OLD.amount,
        status = CASE 
            WHEN remaining_balance + OLD.amount >= amount THEN 'active'
            ELSE status
        END,
        updated_at = now()
    WHERE id = OLD.transaction_id;
    
    RETURN OLD;
END;
$$;

-- Create trigger for payment deletion
DROP TRIGGER IF EXISTS update_transaction_balance_on_payment_delete ON public.payments;

CREATE TRIGGER update_transaction_balance_on_payment_delete
    BEFORE DELETE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_transaction_on_payment_delete();