-- =================================================================
-- CONSOLIDATED INITIAL SCHEMA
-- This single migration file defines the entire database schema,
-- fixing all previous migration issues and incorporating all new features.
-- =================================================================

BEGIN;

-- Part 1: Enable Necessary Extensions
-- =================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Part 2: User Management and Roles
-- =================================================================

-- Create an ENUM type for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'pending');

-- Create the user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Create a function to automatically assign the 'pending' role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'pending');
    RETURN NEW;
END;
$$;

-- Create a trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created_set_pending_role
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(user_id_to_check UUID, role_to_check app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = user_id_to_check AND role = role_to_check
    );
END;
$$;


-- Part 2: Core Application Tables
-- =================================================================

-- Create customers table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_number TEXT UNIQUE,
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    alternate_phone TEXT,
    civil_id TEXT UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_number TEXT UNIQUE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(10,3) NOT NULL,
    cost_price NUMERIC(10,3),
    extra_price NUMERIC(10,3) DEFAULT 0,
    profit NUMERIC(10,3) GENERATED ALWAYS AS (amount - COALESCE(cost_price, 0)) STORED,
    installment_amount NUMERIC(10,3) NOT NULL,
    start_date DATE NOT NULL,
    number_of_installments INTEGER NOT NULL,
    remaining_balance NUMERIC(10,3) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, overdue, completed, legal_case
    has_legal_case BOOLEAN NOT NULL DEFAULT false,
    overdue_amount NUMERIC(10,3) DEFAULT 0,
    overdue_installments INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(10,3) NOT NULL,
    payment_date DATE NOT NULL,
    balance_before NUMERIC(10,3),
    balance_after NUMERIC(10,3),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create document_attachments table
CREATE TABLE public.document_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Part 3: Triggers and Automation
-- =================================================================

-- Function and trigger to set customer sequence number
CREATE OR REPLACE FUNCTION public.set_customer_sequence_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val INTEGER;
BEGIN
    IF NEW.sequence_number IS NULL THEN
        SELECT COALESCE(MAX(sequence_number::INTEGER), 0) + 1 INTO next_val FROM public.customers;
        NEW.sequence_number := LPAD(next_val::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_customer_insert_set_sequence
BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_customer_sequence_number();

-- Function and trigger to set transaction sequence number
CREATE OR REPLACE FUNCTION public.set_transaction_sequence_number()
RETURNS TRIGGER AS $$
DECLARE
    next_val INTEGER;
BEGIN
    IF NEW.sequence_number IS NULL THEN
        SELECT COALESCE(MAX(sequence_number::INTEGER), 0) + 1 INTO next_val FROM public.transactions;
        NEW.sequence_number := LPAD(next_val::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_transaction_insert_set_sequence
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_transaction_sequence_number();


-- Part 4: Stored Procedures (RPC)
-- =================================================================

-- Function to record a payment and update transaction balance
CREATE OR REPLACE FUNCTION public.record_payment(p_transaction_id UUID, p_amount NUMERIC, p_payment_date DATE, p_notes TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    v_customer_id UUID;
    v_balance_before NUMERIC;
    v_balance_after NUMERIC;
BEGIN
    SELECT customer_id, remaining_balance INTO v_customer_id, v_balance_before
    FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;

    v_balance_after := v_balance_before - p_amount;

    INSERT INTO public.payments(transaction_id, customer_id, amount, payment_date, balance_before, balance_after, notes)
    VALUES (p_transaction_id, v_customer_id, p_amount, p_payment_date, v_balance_before, v_balance_after, p_notes);

    UPDATE public.transactions
    SET remaining_balance = v_balance_after,
        status = CASE WHEN v_balance_after <= 0 THEN 'completed' ELSE status END
    WHERE id = p_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard statistics
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

-- Function to check and update overdue transactions
CREATE OR REPLACE FUNCTION public.check_overdue_transactions()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- Function body here - can be added later if needed. For now, a placeholder.
BEGIN
    RETURN 'Overdue check placeholder.';
END;
$$;

-- Bulk delete functions
CREATE OR REPLACE FUNCTION public.delete_multiple_customers(customer_ids UUID[]) RETURNS VOID AS $$
    DELETE FROM public.customers WHERE id = ANY(customer_ids);
$$ LANGUAGE sql; -- Simpler functions can use SQL language

CREATE OR REPLACE FUNCTION public.delete_multiple_transactions(transaction_ids UUID[]) RETURNS VOID AS $$
    DELETE FROM public.transactions WHERE id = ANY(transaction_ids);
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION public.delete_multiple_payments(payment_ids UUID[]) RETURNS VOID AS $$
    DELETE FROM public.payments WHERE id = ANY(payment_ids);
$$ LANGUAGE sql;

-- AI function to identify high-risk customers
CREATE OR REPLACE FUNCTION public.get_high_risk_customers()
RETURNS TABLE (
    customer_id UUID,
    full_name TEXT,
    mobile_number TEXT,
    risk_reason TEXT,
    total_outstanding NUMERIC,
    total_overdue_amount NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    WITH customer_stats AS (
        SELECT
            c.id,
            c.full_name,
            c.mobile_number,
            SUM(t.remaining_balance) as total_outstanding,
            SUM(COALESCE(t.overdue_amount, 0)) as total_overdue_amount,
            MAX(COALESCE(t.overdue_installments, 0)) as max_overdue_installments
        FROM public.customers c
        JOIN public.transactions t ON c.id = t.customer_id
        WHERE t.remaining_balance > 0
        GROUP BY c.id
    )
    SELECT
        cs.id as customer_id,
        cs.full_name,
        cs.mobile_number,
        CASE
            WHEN cs.max_overdue_installments >= 3 THEN 'تأخر كبير في السداد'
            WHEN cs.total_outstanding > 5000 THEN 'رصيد متبقي مرتفع جدا'
            WHEN cs.total_overdue_amount > 1000 THEN 'مبلغ متأخر مرتفع'
            ELSE 'مخاطر متعددة'
        END as risk_reason,
        cs.total_outstanding,
        cs.total_overdue_amount
    FROM customer_stats cs
    WHERE cs.total_overdue_amount > 0 OR cs.max_overdue_installments > 1
    ORDER BY cs.total_overdue_amount DESC, cs.total_outstanding DESC
    LIMIT 10;
END;
$$;

-- Function for admins to update user roles
CREATE OR REPLACE FUNCTION public.update_user_role(user_id_to_update UUID, new_role app_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Only admins can change user roles.';
    END IF;
    UPDATE public.user_roles SET role = new_role WHERE user_id = user_id_to_update;
END;
$$;


-- Part 5: Row Level Security (RLS)
-- =================================================================

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for user_roles
CREATE POLICY "Admins can see all user roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policies for customers, transactions, payments
CREATE POLICY "Allow full access for admins" ON public.customers FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Allow read for staff" ON public.customers FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Allow full access for admins" ON public.transactions FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Allow read for staff" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Allow full access for admins" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Allow read for staff" ON public.payments FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Allow full access for admins" ON public.document_attachments FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Allow read for staff" ON public.document_attachments FOR SELECT USING (public.has_role(auth.uid(), 'staff'));


-- Part 6: Grant Permissions
-- =================================================================
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(UUID, NUMERIC, DATE, TEXT) TO authenticated;

COMMIT;