-- Create expense_attachments table
CREATE TABLE IF NOT EXISTS public.expense_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for expense_attachments
ALTER TABLE public.expense_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for expense_attachments
CREATE POLICY "Users can view expense attachments" ON public.expense_attachments
    FOR SELECT USING (public.has_permission('expenses.view'));

CREATE POLICY "Users can create expense attachments" ON public.expense_attachments
    FOR INSERT WITH CHECK (public.has_permission('expenses.create'));

CREATE POLICY "Users can delete expense attachments" ON public.expense_attachments
    FOR DELETE USING (public.has_permission('expenses.delete'));


-- Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    mobile_number TEXT,
    position TEXT,
    salary NUMERIC(10, 3) DEFAULT 0,
    join_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for employees
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Policies for employees (using 'users.manage' permission as a proxy for HR/Admin tasks for now, or we can add 'employees.view' etc later. Let's stick to 'users.manage' or create new ones. The user asked for an employees page. Let's add specific permissions in the previous migration or just use 'settings.view'/'settings.edit' or 'users.manage'. 'users.manage' fits best for now, or I can add 'employees.manage' to the permissions list in the previous file. Actually, I'll add 'employees.view' and 'employees.manage' here to be clean.)

-- Insert new permissions for employees
INSERT INTO public.permissions (code, name, module) VALUES
('employees.view', 'View Employees', 'employees'),
('employees.manage', 'Manage Employees', 'employees')
ON CONFLICT (code) DO NOTHING;

-- Grant to admin by default (and staff if needed, but usually staff don't see other employees info. Let's give admin for now).
-- We can add a migration to grant these to roles later or let the user do it in the UI.

CREATE POLICY "Users can view employees" ON public.employees
    FOR SELECT USING (public.has_permission('employees.view'));

CREATE POLICY "Users can manage employees" ON public.employees
    FOR ALL USING (public.has_permission('employees.manage'));


-- Create employee_attachments table
CREATE TABLE IF NOT EXISTS public.employee_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for employee_attachments
ALTER TABLE public.employee_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for employee_attachments
CREATE POLICY "Users can view employee attachments" ON public.employee_attachments
    FOR SELECT USING (public.has_permission('employees.view'));

CREATE POLICY "Users can manage employee attachments" ON public.employee_attachments
    FOR ALL USING (public.has_permission('employees.manage'));
