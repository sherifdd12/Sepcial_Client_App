-- This script should be run in the Supabase SQL Editor in separate queries as specified in the instructions.

-- SCRIPT 1: Clean up old logic and set up new roles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending' AND enumtypid = 'public.app_role'::regtype) THEN
        ALTER TYPE public.app_role ADD VALUE 'pending' AFTER 'user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'approved' AND enumtypid = 'public.app_role'::regtype) THEN
        ALTER TYPE public.app_role ADD VALUE 'approved' AFTER 'pending';
    END IF;
END
$$;

-- SCRIPT 2: Create the new 'pending' user logic
CREATE OR REPLACE FUNCTION public.handle_new_user_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'pending');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_pending
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_pending();

-- SCRIPT 3: Create helper and security functions
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  role public.app_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can access this function.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email,
    ur.role
  FROM auth.users u
  JOIN public.user_roles ur ON u.id = ur.user_id
  WHERE ur.role = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.is_authorized_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'approved')
  )
$$;

-- SCRIPT 4: Add security to dashboard functions
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    stats JSON;
BEGIN
    IF NOT public.is_authorized_user(auth.uid()) THEN
        RAISE EXCEPTION 'User is not authorized to view dashboard stats.';
    END IF;

    SELECT json_build_object(
        'totalCustomers', (SELECT COUNT(*) FROM public.customers),
        'totalActiveTransactions', (SELECT COUNT(*) FROM public.transactions WHERE "remainingBalance" > 0),
        'totalRevenue', (SELECT COALESCE(SUM("totalAmount"), 0) FROM public.transactions),
        'totalOutstanding', (SELECT COALESCE(SUM("remainingBalance"), 0) FROM public.transactions),
        'totalOverdue', (SELECT COALESCE(SUM("overdueAmount"), 0) FROM public.transactions),
        'overdueTransactions', (SELECT COUNT(*) FROM public.transactions WHERE "overdueAmount" > 0)
    ) INTO stats;

    RETURN stats;
END;
$function$;


CREATE OR REPLACE FUNCTION public.check_overdue_transactions()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    t RECORD;
    updates INT := 0;
    today DATE := CURRENT_DATE;
    months_passed INT;
    paid_installments INT;
    expected_paid_installments INT;
    overdue_installments INT;
    overdue_amount REAL;
BEGIN
    IF NOT public.is_authorized_user(auth.uid()) THEN
        RAISE EXCEPTION 'User is not authorized to check overdue transactions.';
    END IF;

    FOR t IN
        SELECT * FROM public.transactions WHERE "remainingBalance" > 0 AND "legalCase" = false
    LOOP
        months_passed := (EXTRACT(YEAR FROM today) - EXTRACT(YEAR FROM t."firstInstallmentDate")) * 12 +
                         (EXTRACT(MONTH FROM today) - EXTRACT(MONTH FROM t."firstInstallmentDate"));

        IF months_passed >= 0 THEN
            paid_installments := floor(t."amountPaid" / t."installmentAmount");
            expected_paid_installments := months_passed + 1;
            overdue_installments := expected_paid_installments - paid_installments;

            IF overdue_installments > 0 THEN
                overdue_amount := overdue_installments * t."installmentAmount";
                IF t."overdueInstallments" != overdue_installments OR t."overdueAmount" != overdue_amount THEN
                    UPDATE public.transactions
                    SET "overdueInstallments" = overdue_installments, "overdueAmount" = overdue_amount
                    WHERE id = t.id;
                    updates := updates + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN 'Overdue status checked. ' || updates || ' transactions updated.';
END;
$function$;
