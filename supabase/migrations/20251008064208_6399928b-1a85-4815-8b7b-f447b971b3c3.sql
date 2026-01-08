-- Create a helper function to check if a user is authorized (admin or staff)
CREATE OR REPLACE FUNCTION public.is_authorized_user(user_id_to_check uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = user_id_to_check 
        AND role IN ('admin', 'staff')
    );
END;
$$;

-- Update the check_overdue_transactions function to use proper authorization
CREATE OR REPLACE FUNCTION public.check_overdue_transactions()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    t RECORD;
    updates INT := 0;
    today DATE := CURRENT_DATE;
    months_passed INT;
    amount_paid_calc NUMERIC;
    paid_installments INT;
    expected_paid_installments INT;
    overdue_installments_calc INT;
    overdue_amount_calc NUMERIC;
BEGIN
    IF NOT public.is_authorized_user(auth.uid()) THEN
        RAISE EXCEPTION 'User is not authorized to check overdue transactions.';
    END IF;

    FOR t IN
        SELECT * FROM public.transactions 
        WHERE remaining_balance > 0 
        AND (has_legal_case IS NULL OR has_legal_case = false)
    LOOP
        months_passed := (EXTRACT(YEAR FROM today) - EXTRACT(YEAR FROM t.start_date)) * 12 +
                         (EXTRACT(MONTH FROM today) - EXTRACT(MONTH FROM t.start_date));

        IF months_passed >= 0 THEN
            -- Calculate amount_paid as (amount - remaining_balance)
            amount_paid_calc := t.amount - t.remaining_balance;
            paid_installments := FLOOR(amount_paid_calc / t.installment_amount);
            expected_paid_installments := months_passed + 1;
            overdue_installments_calc := expected_paid_installments - paid_installments;

            IF overdue_installments_calc > 0 THEN
                overdue_amount_calc := overdue_installments_calc * t.installment_amount;
                IF t.overdue_installments != overdue_installments_calc OR t.overdue_amount != overdue_amount_calc THEN
                    UPDATE public.transactions
                    SET overdue_installments = overdue_installments_calc, 
                        overdue_amount = overdue_amount_calc,
                        status = CASE 
                            WHEN overdue_installments_calc > 0 THEN 'overdue' 
                            ELSE status 
                        END
                    WHERE id = t.id;
                    updates := updates + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN 'Overdue status checked. ' || updates || ' transactions updated.';
END;
$$;