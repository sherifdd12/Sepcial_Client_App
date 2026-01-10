-- =================================================================
-- CONSOLIDATED SUPABASE SCHEMA MIGRATION SCRIPT
-- =================================================================
-- This script creates the complete database structure for the 
-- Installment Management System WITHOUT any data.
-- 
-- INSTRUCTIONS:
-- 1. Open your NEW Supabase project dashboard
-- 2. Go to SQL Editor
-- 3. Copy and paste this ENTIRE script
-- 4. Click "Run" (or press Ctrl+Enter)
-- 5. Wait for completion
-- =================================================================

BEGIN;

-- =================================================================
-- PART 1: Enable Extensions
-- =================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- =================================================================
-- PART 2: Create Types/ENUMs
-- =================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'pending', 'approved', 'user');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tap_log_status') THEN
        CREATE TYPE public.tap_log_status AS ENUM ('pending', 'confirmed', 'rejected', 'unmatched');
    END IF;
END $$;

-- =================================================================
-- PART 3: Core Tables
-- =================================================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles Table (Legacy/Bridge)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
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

-- Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
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
    status TEXT NOT NULL DEFAULT 'active',
    has_legal_case BOOLEAN NOT NULL DEFAULT false,
    overdue_amount NUMERIC(10,3) DEFAULT 0,
    overdue_installments INTEGER DEFAULT 0,
    notes TEXT,
    legal_case_details JSONB,
    court_collection_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Legal Cases Table
CREATE TABLE IF NOT EXISTS public.legal_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    case_number TEXT NOT NULL,
    automated_number TEXT,
    entity TEXT,
    circle_number TEXT,
    opponent TEXT,
    session_date TEXT,
    session_decision TEXT,
    next_session_date TEXT,
    amount_due TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Legal Fees Table
CREATE TABLE IF NOT EXISTS public.legal_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(10,3) NOT NULL,
    payment_date DATE NOT NULL,
    balance_before NUMERIC(10,3),
    balance_after NUMERIC(10,3),
    penalty_amount NUMERIC(10,3) DEFAULT 0,
    notes TEXT,
    payment_method TEXT DEFAULT 'other' CHECK (payment_method IN ('tap', 'other', 'court_collection', 'cash', 'bank_transfer')),
    tap_charge_id TEXT UNIQUE,
    legal_case_id UUID REFERENCES public.legal_cases(id) ON DELETE SET NULL,
    legal_fee_id UUID REFERENCES public.legal_fees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document Attachments Table
CREATE TABLE IF NOT EXISTS public.document_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    description TEXT,
    bucket_name TEXT DEFAULT 'documents',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Permissions Table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- App Roles Table
CREATE TABLE IF NOT EXISTS public.app_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Role Permissions Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.app_roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    reason TEXT,
    refund_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('salaries', 'equipment', 'repairs_ink', 'rent_internet', 'other')),
    amount NUMERIC(10,3) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Expense Attachments Table
CREATE TABLE IF NOT EXISTS public.expense_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    mobile_number TEXT,
    position TEXT,
    salary NUMERIC(10, 3) DEFAULT 0,
    join_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Employee Attachments Table
CREATE TABLE IF NOT EXISTS public.employee_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tap_id TEXT UNIQUE,
    amount NUMERIC(10, 3),
    currency TEXT DEFAULT 'KWD',
    status TEXT DEFAULT 'INITIATED',
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id)
);

-- User Logs Table
CREATE TABLE IF NOT EXISTS public.user_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tap Webhook Logs Table
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
    matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    matched_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES auth.users(id),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- PART 4: Views
-- =================================================================

CREATE OR REPLACE VIEW public.legal_cases_with_stats AS
SELECT 
    lc.id,
    lc.customer_id,
    lc.transaction_id,
    lc.case_number,
    lc.automated_number,
    lc.entity,
    lc.circle_number,
    lc.opponent,
    lc.session_date,
    lc.session_decision,
    lc.next_session_date,
    lc.amount_due,
    lc.notes,
    lc.created_at,
    lc.updated_at,
    c.full_name as customer_name,
    c.sequence_number as customer_sequence,
    t.sequence_number as transaction_sequence,
    (SELECT COUNT(*)::INTEGER FROM public.transactions WHERE customer_id = lc.customer_id) as transactions_count,
    (SELECT COALESCE(SUM(remaining_balance), 0)::NUMERIC FROM public.transactions WHERE customer_id = lc.customer_id) as total_debt,
    (SELECT COALESCE(SUM(amount), 0)::NUMERIC FROM public.payments WHERE customer_id = lc.customer_id) as total_paid,
    (SELECT MAX(payment_date) FROM public.payments WHERE customer_id = lc.customer_id) as last_payment_date,
    (SELECT p.amount FROM public.payments p WHERE p.customer_id = lc.customer_id ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 1) as last_payment_amount
FROM public.legal_cases lc
LEFT JOIN public.customers c ON lc.customer_id = c.id
LEFT JOIN public.transactions t ON lc.transaction_id = t.id;

-- =================================================================
-- PART 5: Helper Functions
-- =================================================================

-- Update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set customer sequence number
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

-- Set transaction sequence number
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

-- Handle new user (create profile and assign pending role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );

    -- Assign pending role in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'pending')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

-- Has role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.app_roles ar ON ar.id::text = ur.role
    WHERE ur.user_id = _user_id
    AND (
      ur.role = _role
      OR
      ar.name = _role
    )
  );
END;
$$;

-- Has permission function
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role_name TEXT;
    has_perm BOOLEAN;
BEGIN
    SELECT role INTO user_role_name
    FROM public.user_roles
    WHERE public.user_roles.user_id = has_permission.user_id;

    IF user_role_name IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.app_roles r ON r.id = rp.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE r.name = user_role_name
        AND p.code = permission_code
    ) INTO has_perm;

    RETURN has_perm;
END;
$$;

-- Is authorized user
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
      AND role IN ('admin', 'approved', 'staff')
  )
$$;

-- Get pending users
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT
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

-- Log user login
CREATE OR REPLACE FUNCTION public.log_user_login(p_user_id UUID, p_ip TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_logs (user_id, action_type, ip_address, user_agent)
    VALUES (p_user_id, 'login', p_ip, p_user_agent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================
-- PART 6: Business Logic Functions
-- =================================================================

-- Record Payment
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

    -- If linked to a legal fee, mark it as paid
    IF p_legal_fee_id IS NOT NULL THEN
        UPDATE public.legal_fees
        SET status = 'paid', updated_at = NOW()
        WHERE id = p_legal_fee_id;
    END IF;

    RETURN v_payment_id;
END;
$$;

-- Get Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
    total_customers BIGINT,
    total_active_transactions BIGINT,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    total_outstanding NUMERIC,
    total_overdue NUMERIC,
    overdue_transactions BIGINT,
    total_legal_fees NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
    IF NOT public.is_authorized_user(auth.uid()) THEN
        RAISE EXCEPTION 'User is not authorized to view dashboard stats.';
    END IF;

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.customers) AS total_customers,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'active' OR status = 'overdue') AS total_active_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments) AS total_revenue,
        (SELECT COALESCE(SUM(t.amount), 0) - COALESCE(SUM(t.cost_price), 0) FROM public.transactions t) AS total_profit,
        ((SELECT COALESCE(SUM(amount), 0) FROM public.transactions) + (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active') - (SELECT COALESCE(SUM(amount), 0) FROM public.payments)) AS total_outstanding,
        (SELECT COALESCE(SUM(overdue_amount), 0) FROM public.transactions WHERE status = 'overdue') AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue') AS overdue_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active') AS total_legal_fees;
END;
$$;

-- Get Filtered Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_filtered_dashboard_stats(p_year int DEFAULT 0, p_month int DEFAULT 0)
RETURNS TABLE (
    total_customers BIGINT,
    total_active_transactions BIGINT,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    total_outstanding NUMERIC,
    total_overdue NUMERIC,
    overdue_transactions BIGINT,
    tap_revenue NUMERIC,
    court_revenue NUMERIC,
    other_revenue NUMERIC,
    collected_profit NUMERIC,
    total_legal_fees NUMERIC,
    total_expenses NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    filter_start_date DATE;
    filter_end_date DATE;
BEGIN
    IF NOT public.is_authorized_user(auth.uid()) THEN
        RAISE EXCEPTION 'User is not authorized to view dashboard stats.';
    END IF;

    IF p_year > 0 THEN
        IF p_month > 0 THEN
            filter_start_date := make_date(p_year, p_month, 1);
            filter_end_date := (filter_start_date + interval '1 month' - interval '1 day')::date;
        ELSE
            filter_start_date := make_date(p_year, 1, 1);
            filter_end_date := make_date(p_year, 12, 31);
        END IF;
    ELSE
        filter_start_date := '1900-01-01'::date;
        filter_end_date := '2100-12-31'::date;
    END IF;

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.customers WHERE created_at::date <= filter_end_date) AS total_customers,
        (SELECT COUNT(*) FROM public.transactions WHERE created_at::date <= filter_end_date AND (status = 'active' OR status = 'overdue')) AS total_active_transactions,
        ((SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) - 
         (SELECT COALESCE(SUM(amount), 0) FROM public.refunds WHERE refund_date::date BETWEEN filter_start_date AND filter_end_date)) AS total_revenue,
        (SELECT COALESCE(SUM(amount - cost_price), 0) FROM public.transactions WHERE created_at::date BETWEEN filter_start_date AND filter_end_date) AS total_profit,
        ((SELECT COALESCE(SUM(amount), 0) FROM public.transactions WHERE created_at::date <= filter_end_date) + (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active' AND created_at::date <= filter_end_date) - (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date <= filter_end_date) + (SELECT COALESCE(SUM(amount), 0) FROM public.refunds WHERE refund_date::date <= filter_end_date)) AS total_outstanding,
        (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN remaining_balance <= 0 THEN 0
                    ELSE 
                        GREATEST(0, 
                            (LEAST(
                                (EXTRACT(YEAR FROM filter_end_date) - EXTRACT(YEAR FROM start_date)) * 12 + 
                                (EXTRACT(MONTH FROM filter_end_date) - EXTRACT(MONTH FROM start_date)) + 1,
                                number_of_installments
                            ) * installment_amount) - (amount - remaining_balance)
                        )
                END
            ), 0)
            FROM public.transactions 
            WHERE created_at::date <= filter_end_date AND remaining_balance > 0 AND has_legal_case = false
        ) AS total_overdue,
        (SELECT COUNT(*) FROM public.transactions WHERE status = 'overdue' AND created_at::date <= filter_end_date) AS overdue_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'tap' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS tap_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'court_collection' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS court_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_method = 'other' AND payment_date::date BETWEEN filter_start_date AND filter_end_date) AS other_revenue,
        (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE payment_date::date BETWEEN filter_start_date AND filter_end_date) AS collected_profit,
        (SELECT COALESCE(SUM(amount), 0) FROM public.legal_fees WHERE status = 'active' AND created_at::date <= filter_end_date) AS total_legal_fees,
        (SELECT COALESCE(SUM(amount), 0) FROM public.expenses WHERE expense_date BETWEEN filter_start_date AND filter_end_date) AS total_expenses;
END;
$$;

-- Check Overdue Transactions
CREATE OR REPLACE FUNCTION public.check_overdue_transactions()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    t RECORD;
    updates INT := 0;
    today DATE := CURRENT_DATE;
    months_passed INT;
    paid_installments INT;
    expected_paid_installments INT;
    v_overdue_installments INT;
    v_overdue_amount REAL;
BEGIN
    IF NOT public.is_authorized_user(auth.uid()) THEN
        RAISE EXCEPTION 'User is not authorized to check overdue transactions.';
    END IF;

    FOR t IN
        SELECT * FROM public.transactions WHERE remaining_balance > 0 AND has_legal_case = false
    LOOP
        months_passed := (EXTRACT(YEAR FROM today) - EXTRACT(YEAR FROM t.start_date)) * 12 +
                         (EXTRACT(MONTH FROM today) - EXTRACT(MONTH FROM t.start_date));

        IF months_passed >= 0 THEN
            paid_installments := floor((t.amount - t.remaining_balance) / t.installment_amount);
            expected_paid_installments := months_passed + 1;
            v_overdue_installments := expected_paid_installments - paid_installments;

            IF v_overdue_installments > 0 THEN
                v_overdue_amount := v_overdue_installments * t.installment_amount;
                IF t.overdue_installments != v_overdue_installments OR t.overdue_amount != v_overdue_amount THEN
                    UPDATE public.transactions
                    SET overdue_installments = v_overdue_installments, overdue_amount = v_overdue_amount, status = 'overdue'
                    WHERE id = t.id;
                    updates := updates + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN 'Overdue status checked. ' || updates || ' transactions updated.';
END;
$$;

-- Get Customer Balance
CREATE OR REPLACE FUNCTION public.get_customer_balance(p_customer_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_total_paid NUMERIC;
    v_total_debt NUMERIC;
    v_total_refunded NUMERIC;
    v_total_legal_fees NUMERIC;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.payments
    WHERE customer_id = p_customer_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_debt
    FROM public.transactions
    WHERE customer_id = p_customer_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_legal_fees
    FROM public.legal_fees
    WHERE customer_id = p_customer_id AND status != 'refunded';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded
    FROM public.refunds
    WHERE customer_id = p_customer_id;

    RETURN v_total_paid - (v_total_debt + v_total_legal_fees) - v_total_refunded;
END;
$$;

-- Get Financial Report
CREATE OR REPLACE FUNCTION public.get_financial_report(
    start_date DATE,
    end_date DATE,
    transaction_statuses TEXT[]
)
RETURNS TABLE (
    total_item_price NUMERIC,
    total_additional_price NUMERIC,
    total_price NUMERIC,
    total_installment_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(t.amount), 0) AS total_item_price,
        COALESCE(SUM(t.extra_price), 0) AS total_additional_price,
        COALESCE(SUM(t.amount + t.extra_price), 0) AS total_price,
        COALESCE(SUM(CASE WHEN t.status = 'active' THEN t.remaining_balance ELSE 0 END), 0) AS total_installment_value
    FROM public.transactions t
    WHERE t.start_date >= start_date AND t.start_date <= end_date
    AND (cardinality(transaction_statuses) = 0 OR t.status = ANY(transaction_statuses));
END;
$$;

-- Bulk Delete Functions
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

-- Audit Log Function
CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_action TEXT;
    v_old_data JSONB := NULL;
    v_new_data JSONB := NULL;
BEGIN
    v_user_id := auth.uid();
    v_action := TG_OP;

    IF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
    END IF;

    INSERT INTO public.user_logs (
        user_id,
        action_type,
        table_name,
        record_id,
        old_data,
        new_data
    ) VALUES (
        v_user_id,
        LOWER(v_action),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_old_data,
        v_new_data
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =================================================================
-- PART 7: Triggers
-- =================================================================

-- User creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sequence number triggers
DROP TRIGGER IF EXISTS before_customer_insert_set_sequence ON public.customers;
CREATE TRIGGER before_customer_insert_set_sequence
BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_customer_sequence_number();

DROP TRIGGER IF EXISTS before_transaction_insert_set_sequence ON public.transactions;
CREATE TRIGGER before_transaction_insert_set_sequence
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_transaction_sequence_number();

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_legal_cases_updated_at ON public.legal_cases;
CREATE TRIGGER update_legal_cases_updated_at
    BEFORE UPDATE ON public.legal_cases
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_legal_fees_updated_at ON public.legal_fees;
CREATE TRIGGER update_legal_fees_updated_at
    BEFORE UPDATE ON public.legal_fees
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();

-- Audit triggers
DROP TRIGGER IF EXISTS audit_customers_trigger ON public.customers;
CREATE TRIGGER audit_customers_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

DROP TRIGGER IF EXISTS audit_transactions_trigger ON public.transactions;
CREATE TRIGGER audit_transactions_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

DROP TRIGGER IF EXISTS audit_payments_trigger ON public.payments;
CREATE TRIGGER audit_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

-- =================================================================
-- PART 8: Indexes
-- =================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_cases_case_number ON public.legal_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_legal_cases_customer_id ON public.legal_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_transaction_id ON public.legal_cases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_tap_charge_id ON public.payments(tap_charge_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);

-- =================================================================
-- PART 9: Row Level Security (RLS)
-- =================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tap_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User Roles Policies
DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
CREATE POLICY "Users can read their own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Customers Policies
DROP POLICY IF EXISTS "Allow full access for admins" ON public.customers;
CREATE POLICY "Allow full access for admins" ON public.customers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Allow read for staff" ON public.customers;
CREATE POLICY "Allow read for staff" ON public.customers FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

-- Transactions Policies
DROP POLICY IF EXISTS "Allow full access for admins" ON public.transactions;
CREATE POLICY "Allow full access for admins" ON public.transactions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Allow read for staff" ON public.transactions;
CREATE POLICY "Allow read for staff" ON public.transactions FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

-- Payments Policies
DROP POLICY IF EXISTS "Allow full access for admins" ON public.payments;
CREATE POLICY "Allow full access for admins" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Allow read for staff" ON public.payments;
CREATE POLICY "Allow read for staff" ON public.payments FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

-- Document Attachments Policies
DROP POLICY IF EXISTS "Allow full access for admins" ON public.document_attachments;
CREATE POLICY "Allow full access for admins" ON public.document_attachments FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Allow read for staff" ON public.document_attachments;
CREATE POLICY "Allow read for staff" ON public.document_attachments FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

-- RBAC Policies
DROP POLICY IF EXISTS "Allow read access to permissions" ON public.permissions;
CREATE POLICY "Allow read access to permissions" ON public.permissions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow full access to permissions for admins" ON public.permissions;
CREATE POLICY "Allow full access to permissions for admins" ON public.permissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Allow read access to app_roles" ON public.app_roles;
CREATE POLICY "Allow read access to app_roles" ON public.app_roles FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow full access to app_roles for admins" ON public.app_roles;
CREATE POLICY "Allow full access to app_roles for admins" ON public.app_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Allow read access to role_permissions" ON public.role_permissions;
CREATE POLICY "Allow read access to role_permissions" ON public.role_permissions FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow full access to role_permissions for admins" ON public.role_permissions;
CREATE POLICY "Allow full access to role_permissions for admins" ON public.role_permissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Legal System Policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.legal_cases;
CREATE POLICY "Enable read access for authenticated users" ON public.legal_cases FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable manage access for admins" ON public.legal_cases;
CREATE POLICY "Enable manage access for admins" ON public.legal_cases FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Enable read access for legal_fees" ON public.legal_fees;
CREATE POLICY "Enable read access for legal_fees" ON public.legal_fees FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable manage access for legal_fees" ON public.legal_fees;
CREATE POLICY "Enable manage access for legal_fees" ON public.legal_fees FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Refunds Policies
DROP POLICY IF EXISTS "Enable read access for refunds" ON public.refunds;
CREATE POLICY "Enable read access for refunds" ON public.refunds FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable manage access for refunds" ON public.refunds;
CREATE POLICY "Enable manage access for refunds" ON public.refunds FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Expenses Policies
DROP POLICY IF EXISTS "Enable read access for expenses" ON public.expenses;
CREATE POLICY "Enable read access for expenses" ON public.expenses FOR SELECT USING (public.has_permission(auth.uid(), 'expenses.view'));
DROP POLICY IF EXISTS "Enable manage access for expenses" ON public.expenses;
CREATE POLICY "Enable manage access for expenses" ON public.expenses FOR ALL USING (public.has_permission(auth.uid(), 'expenses.create'));
DROP POLICY IF EXISTS "Users can view expense attachments" ON public.expense_attachments;
CREATE POLICY "Users can view expense attachments" ON public.expense_attachments FOR SELECT USING (public.has_permission(auth.uid(), 'expenses.view'));
DROP POLICY IF EXISTS "Users can manage expense attachments" ON public.expense_attachments;
CREATE POLICY "Users can manage expense attachments" ON public.expense_attachments FOR ALL USING (public.has_permission(auth.uid(), 'expenses.create'));

-- Employees Policies
DROP POLICY IF EXISTS "Users can view employees" ON public.employees;
CREATE POLICY "Users can view employees" ON public.employees FOR SELECT USING (public.has_permission(auth.uid(), 'employees.view'));
DROP POLICY IF EXISTS "Users can manage employees" ON public.employees;
CREATE POLICY "Users can manage employees" ON public.employees FOR ALL USING (public.has_permission(auth.uid(), 'employees.manage'));
DROP POLICY IF EXISTS "Users can view employee attachments" ON public.employee_attachments;
CREATE POLICY "Users can view employee attachments" ON public.employee_attachments FOR SELECT USING (public.has_permission(auth.uid(), 'employees.view'));
DROP POLICY IF EXISTS "Users can manage employee attachments" ON public.employee_attachments;
CREATE POLICY "Users can manage employee attachments" ON public.employee_attachments FOR ALL USING (public.has_permission(auth.uid(), 'employees.manage'));

-- Invoices Policies
DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
CREATE POLICY "Admins can manage all invoices" ON public.invoices FOR ALL USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Staff can view all invoices" ON public.invoices;
CREATE POLICY "Staff can view all invoices" ON public.invoices FOR SELECT USING (public.has_role(auth.uid(), 'staff'));

-- App Settings Policies
DROP POLICY IF EXISTS "Allow read access to app_settings" ON public.app_settings;
CREATE POLICY "Allow read access to app_settings" ON public.app_settings FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow full access to app_settings for admins" ON public.app_settings;
CREATE POLICY "Allow full access to app_settings for admins" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User Logs Policies
DROP POLICY IF EXISTS "Admins can see all logs" ON public.user_logs;
CREATE POLICY "Admins can see all logs" ON public.user_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Tap Webhook Logs Policies
DROP POLICY IF EXISTS "Admins can manage tap webhook logs" ON public.tap_webhook_logs;
CREATE POLICY "Admins can manage tap webhook logs" ON public.tap_webhook_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =================================================================
-- PART 10: Seed Data
-- =================================================================

-- Seed Permissions
INSERT INTO public.permissions (code, name, module, description) VALUES
('dashboard.view', 'View Dashboard', 'Dashboard', 'Access to view the main dashboard'),
('dashboard.stats', 'View Dashboard Stats', 'Dashboard', 'View financial statistics on dashboard'),
('customers.view', 'View Customers', 'Customers', 'View customer list and details'),
('customers.create', 'Create Customer', 'Customers', 'Add new customers'),
('customers.edit', 'Edit Customer', 'Customers', 'Edit existing customer details'),
('customers.delete', 'Delete Customer', 'Customers', 'Delete customers'),
('transactions.view', 'View Transactions', 'Transactions', 'View transaction list and details'),
('transactions.create', 'Create Transaction', 'Transactions', 'Create new transactions'),
('transactions.edit', 'Edit Transaction', 'Transactions', 'Edit existing transactions'),
('transactions.delete', 'Delete Transaction', 'Transactions', 'Delete transactions'),
('transactions.approve', 'Approve Transaction', 'Transactions', 'Approve pending transactions'),
('payments.view', 'View Payments', 'Payments', 'View payment history'),
('payments.create', 'Record Payment', 'Payments', 'Record new payments'),
('payments.edit', 'Edit Payment', 'Payments', 'Edit existing payments'),
('payments.delete', 'Delete Payment', 'Payments', 'Delete payments'),
('expenses.view', 'View Expenses', 'Expenses', 'View expenses list'),
('expenses.create', 'Create Expense', 'Expenses', 'Record new expenses'),
('expenses.edit', 'Edit Expense', 'Expenses', 'Edit existing expenses'),
('expenses.delete', 'Delete Expense', 'Expenses', 'Delete expenses'),
('reports.view', 'View Reports', 'Reports', 'Access financial reports'),
('reports.export', 'Export Reports', 'Reports', 'Export data to Excel/PDF'),
('settings.view', 'View Settings', 'Settings', 'View application settings'),
('settings.edit', 'Edit Settings', 'Settings', 'Modify application settings'),
('users.manage', 'Manage Users', 'Admin', 'Manage system users and roles'),
('roles.manage', 'Manage Roles', 'Admin', 'Create and modify roles and permissions'),
('employees.view', 'View Employees', 'employees', 'View employees list'),
('employees.manage', 'Manage Employees', 'employees', 'Manage employees'),
('can_export_data', 'تصدير البيانات', 'system', 'إمكانية تصدير البيانات إلى Excel أو PDF')
ON CONFLICT (code) DO NOTHING;

-- Seed Roles
INSERT INTO public.app_roles (name, description, is_system_role) VALUES
('admin', 'Administrator with full access', true),
('staff', 'Staff member with standard access', true),
('viewer', 'Read-only access', false)
ON CONFLICT (name) DO NOTHING;

-- Assign Permissions to Roles
-- Admin: All permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Staff: Standard access
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r, public.permissions p
WHERE r.name = 'staff'
AND p.code NOT IN (
    'customers.delete',
    'transactions.delete',
    'payments.delete',
    'expenses.delete',
    'users.manage',
    'roles.manage',
    'settings.edit'
)
ON CONFLICT DO NOTHING;

-- =================================================================
-- PART 11: Storage Buckets
-- =================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
('payment_uploads', 'payment_uploads', true),
('documents', 'documents', true),
('expense_attachments', 'expense_attachments', true),
('employee_attachments', 'employee_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Allow authenticated users to upload" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('payment_uploads', 'documents', 'expense_attachments', 'employee_attachments'));
DROP POLICY IF EXISTS "Allow authenticated users to view" ON storage.objects;
CREATE POLICY "Allow authenticated users to view" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('payment_uploads', 'documents', 'expense_attachments', 'employee_attachments'));
DROP POLICY IF EXISTS "Allow admins to delete" ON storage.objects;
CREATE POLICY "Allow admins to delete" ON storage.objects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =================================================================
-- PART 12: Grant Permissions
-- =================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =================================================================
-- PART 13: Enable Realtime
-- =================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Check if the table is already in the publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'invoices'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    END IF;
END $$;

-- Customer Service Chat Feature
-- 1. Drop the existing table and its policies to start fresh
DROP TABLE IF EXISTS public.customer_service_logs CASCADE;

-- 2. Create the table with correct relationships
CREATE TABLE public.customer_service_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('employee', 'customer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Security
ALTER TABLE public.customer_service_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create Indexes for performance
CREATE INDEX idx_customer_service_logs_customer_id ON public.customer_service_logs(customer_id);
CREATE INDEX idx_customer_service_logs_created_at ON public.customer_service_logs(created_at);

-- 5. Create Security Policies
CREATE POLICY "Enable read access for authenticated users" ON public.customer_service_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.customer_service_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);

-- 6. Enable Realtime updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'customer_service_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_service_logs;
    END IF;
END $$;

-- Employee Tasks Feature
-- 1. Create employee_tasks table
CREATE TABLE IF NOT EXISTS public.employee_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed')),
    due_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    legal_case_id UUID REFERENCES public.legal_cases(id) ON DELETE SET NULL,
    completion_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create task_attachments table
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.employee_tasks(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    related_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Users can see tasks assigned to them or created by them" ON public.employee_tasks;
CREATE POLICY "Users can see tasks assigned to them or created by them" ON public.employee_tasks FOR SELECT TO authenticated USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Users can create tasks" ON public.employee_tasks;
CREATE POLICY "Users can create tasks" ON public.employee_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can update tasks assigned to them or created by them" ON public.employee_tasks;
CREATE POLICY "Users can update tasks assigned to them or created by them" ON public.employee_tasks FOR UPDATE TO authenticated USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
CREATE POLICY "Users can see their own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 6. Trigger for notifications
CREATE OR REPLACE FUNCTION public.handle_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN
        IF NEW.assigned_to != NEW.created_by THEN
            INSERT INTO public.notifications (user_id, title, message, type, related_id)
            VALUES (NEW.assigned_to, 'مهمة جديدة', 'تم تعيين مهمة جديدة لك: ' || NEW.title, 'task_assigned', NEW.id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_assigned ON public.employee_tasks;
CREATE TRIGGER on_task_assigned AFTER INSERT OR UPDATE ON public.employee_tasks FOR EACH ROW EXECUTE FUNCTION public.handle_task_assignment();

-- 7. Add to realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employee_tasks') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_tasks;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

-- 8. Storage Bucket for Task Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for Task Attachments
DROP POLICY IF EXISTS "Allow authenticated users to upload to task-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload to task-attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-attachments');
DROP POLICY IF EXISTS "Allow authenticated users to view task-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated users to view task-attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'task-attachments');

COMMIT;
