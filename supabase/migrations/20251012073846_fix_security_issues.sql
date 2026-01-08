/*
  # Fix Security Issues
  
  1. Security Improvements
    - Fix function search_path for all functions (set to immutable)
    - Remove anonymous access from RLS policies
    - Keep existing authenticated user access intact
  
  2. Changes
    - Update all functions to use SECURITY DEFINER with immutable search_path
    - Update RLS policies to only allow authenticated users (no anon access)
    - No data loss, no user disruption
  
  3. Important
    - All existing users and data remain intact
    - Only security policies are updated
*/

-- Fix function search_path for handle_new_user
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'pending');
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_set_pending_role
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix function search_path for has_role
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role);
CREATE OR REPLACE FUNCTION public.has_role(user_id_to_check UUID, role_to_check app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = user_id_to_check AND role = role_to_check
    );
END;
$$;

-- Fix function search_path for sequence generators
DROP FUNCTION IF EXISTS public.set_customer_sequence_number() CASCADE;
CREATE OR REPLACE FUNCTION public.set_customer_sequence_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_seq INTEGER;
BEGIN
    IF NEW.sequence_number IS NULL THEN
        SELECT COALESCE(MAX(CAST(sequence_number AS INTEGER)), 0) + 1
        INTO next_seq
        FROM public.customers
        WHERE sequence_number ~ '^[0-9]+$';
        NEW.sequence_number := next_seq::TEXT;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER before_customer_insert_set_sequence
BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_customer_sequence_number();

DROP FUNCTION IF EXISTS public.set_transaction_sequence_number() CASCADE;
CREATE OR REPLACE FUNCTION public.set_transaction_sequence_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_seq INTEGER;
BEGIN
    IF NEW.sequence_number IS NULL THEN
        SELECT COALESCE(MAX(CAST(sequence_number AS INTEGER)), 0) + 1
        INTO next_seq
        FROM public.transactions
        WHERE sequence_number ~ '^[0-9]+$';
        NEW.sequence_number := next_seq::TEXT;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER before_transaction_insert_set_sequence
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_transaction_sequence_number();

-- Fix function search_path for payment recording
DROP FUNCTION IF EXISTS public.record_payment(UUID, NUMERIC, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.record_payment(
    p_transaction_id UUID, 
    p_amount NUMERIC, 
    p_payment_date DATE DEFAULT CURRENT_DATE, 
    p_notes TEXT DEFAULT NULL
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
        notes
    )
    VALUES (
        p_transaction_id, 
        v_customer_id, 
        p_amount, 
        p_payment_date, 
        v_balance_before, 
        v_balance_after, 
        v_penalty_amount,
        p_notes
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

-- Fix function search_path for helper functions
DROP FUNCTION IF EXISTS public.delete_multiple_customers(UUID[]);
CREATE OR REPLACE FUNCTION public.delete_multiple_customers(customer_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.customers WHERE id = ANY(customer_ids);
END;
$$;

DROP FUNCTION IF EXISTS public.delete_multiple_transactions(UUID[]);
CREATE OR REPLACE FUNCTION public.delete_multiple_transactions(transaction_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.transactions WHERE id = ANY(transaction_ids);
END;
$$;

DROP FUNCTION IF EXISTS public.delete_multiple_payments(UUID[]);
CREATE OR REPLACE FUNCTION public.delete_multiple_payments(payment_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.payments WHERE id = ANY(payment_ids);
END;
$$;

-- Fix function search_path for dashboard stats
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
    total_customers BIGINT,
    total_active_transactions BIGINT,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    total_outstanding NUMERIC,
    total_overdue NUMERIC,
    overdue_transactions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.customers) AS total_customers,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'active' OR status = 'overdue') AS total_active_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.transactions) AS total_revenue,
        (SELECT COALESCE(SUM(profit), 0) FROM public.transactions) AS total_profit,
        (SELECT COALESCE(SUM(remaining_balance), 0) FROM public.transactions WHERE status = 'active' OR status = 'overdue') AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue') AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue') AS overdue_transactions;
END;
$$;

DROP FUNCTION IF EXISTS public.get_customer_overview();
CREATE OR REPLACE FUNCTION public.get_customer_overview()
RETURNS TABLE (
    customer_id UUID,
    customer_name TEXT,
    total_transactions BIGINT,
    total_amount NUMERIC,
    total_outstanding NUMERIC,
    total_overdue_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as customer_id,
        c.full_name as customer_name,
        COUNT(t.id) as total_transactions,
        SUM(t.amount) as total_amount,
        SUM(t.remaining_balance) as total_outstanding,
        SUM(LEAST(COALESCE(t.overdue_amount, 0), t.remaining_balance)) as total_overdue_amount
    FROM public.customers c
    LEFT JOIN public.transactions t ON c.id = t.customer_id
    WHERE t.remaining_balance > 0
    GROUP BY c.id, c.full_name;
END;
$$;

-- Fix function search_path for cloud path generation
DROP FUNCTION IF EXISTS public.generate_cloud_path(TEXT, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.generate_cloud_path(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_file_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_customer_name TEXT;
    v_customer_code TEXT;
    v_transaction_number TEXT;
    v_cloud_path TEXT;
BEGIN
    IF p_entity_type = 'customer' THEN
        SELECT full_name, sequence_number INTO v_customer_name, v_customer_code
        FROM public.customers WHERE id = p_entity_id;
        v_cloud_path := v_customer_name || '-' || v_customer_code || '/' || p_file_name;
        
    ELSIF p_entity_type = 'transaction' THEN
        SELECT c.full_name, c.sequence_number, t.sequence_number
        INTO v_customer_name, v_customer_code, v_transaction_number
        FROM public.transactions t
        JOIN public.customers c ON t.customer_id = c.id
        WHERE t.id = p_entity_id;
        v_cloud_path := v_customer_name || '-' || v_customer_code || '/' || v_transaction_number || '/' || p_file_name;
        
    ELSIF p_entity_type = 'payment' THEN
        SELECT c.full_name, c.sequence_number, t.sequence_number
        INTO v_customer_name, v_customer_code, v_transaction_number
        FROM public.payments p
        JOIN public.transactions t ON p.transaction_id = t.id
        JOIN public.customers c ON p.customer_id = c.id
        WHERE p.id = p_entity_id;
        v_cloud_path := v_customer_name || '-' || v_customer_code || '/' || v_transaction_number || '/payments/' || p_file_name;
    END IF;
    
    RETURN v_cloud_path;
END;
$$;

-- Fix function search_path for cleanup
DROP FUNCTION IF EXISTS public.cleanup_attachments() CASCADE;
CREATE OR REPLACE FUNCTION public.cleanup_attachments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.attachments
    WHERE entity_id = OLD.id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER cleanup_customer_attachments
    BEFORE DELETE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.cleanup_attachments();

CREATE TRIGGER cleanup_transaction_attachments
    BEFORE DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.cleanup_attachments();

CREATE TRIGGER cleanup_payment_attachments
    BEFORE DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.cleanup_attachments();

-- Remove anonymous access from RLS policies
-- Drop old policies and recreate without anon access

-- User roles policies
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Admins can view all user roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage user roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );