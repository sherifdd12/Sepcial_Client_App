-- Create user_logs table
CREATE TABLE IF NOT EXISTS public.user_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'login', 'create', 'update', 'delete'
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_logs ENABLE ROW LEVEL SECURITY;

-- Admin only policy
CREATE POLICY "Admins can see all logs" ON public.user_logs
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Function to handle audit logging
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

-- Add triggers to core tables
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

-- Function to log login events (to be called from frontend or edge function)
CREATE OR REPLACE FUNCTION public.log_user_login(p_user_id UUID, p_ip TEXT DEFAULT NULL, p_user_agent TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_logs (user_id, action_type, ip_address, user_agent)
    VALUES (p_user_id, 'login', p_ip, p_user_agent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
