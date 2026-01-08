import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://odeqbnntvogchzipniig.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZXFibm50dm9nY2h6aXBuaWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5Mjc5OTgsImV4cCI6MjA3MjUwMzk5OH0.phWW0hNm-ujEEsngjhf88us4suJv9boQ_9uh7ADhTXQ'
);

// Function to create tables
const createTables = async () => {
  // Create customers table
  const { error: customersError } = await supabase.rpc('exec_sql', {
    sql: `
      -- Drop existing customers table if it exists
      DROP TABLE IF EXISTS public.customers CASCADE;

      -- Create customers table with snake_case column names
      CREATE TABLE public.customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          full_name TEXT NOT NULL,
          mobile_number TEXT NOT NULL,
          civil_id TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Enable RLS
      ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

      -- Create indices
      CREATE INDEX IF NOT EXISTS customers_civil_id_idx ON public.customers (civil_id);
      CREATE INDEX IF NOT EXISTS customers_mobile_number_idx ON public.customers (mobile_number);

      -- Create RLS policies
      CREATE POLICY "Enable read access for all users" ON public.customers
          FOR SELECT USING (true);

      CREATE POLICY "Enable insert for authenticated users only" ON public.customers
          FOR INSERT WITH CHECK (auth.role() = 'authenticated');

      CREATE POLICY "Enable update for authenticated users only" ON public.customers
          FOR UPDATE USING (auth.role() = 'authenticated')
          WITH CHECK (auth.role() = 'authenticated');

      CREATE POLICY "Enable delete for authenticated users only" ON public.customers
          FOR DELETE USING (auth.role() = 'authenticated');
    `
  });

  if (customersError) {
    console.error('Error creating customers table:', customersError);
    return;
  }

  console.log('Tables created successfully');
};

// Run the table creation
createTables().catch(console.error);
