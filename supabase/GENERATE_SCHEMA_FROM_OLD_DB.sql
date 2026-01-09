-- =================================================================
-- GENERATE SCHEMA SQL FROM YOUR OLD SUPABASE DATABASE
-- =================================================================
-- INSTRUCTIONS:
-- 
-- STEP 1: In your OLD Supabase project (the one with data):
--   1. Go to SQL Editor
--   2. Copy and paste this ENTIRE script
--   3. Click "Run"
--   4. Copy ALL the output (it will be CREATE TABLE, CREATE FUNCTION, etc. statements)
--
-- STEP 2: In your NEW Supabase project (the empty one):
--   1. Go to SQL Editor
--   2. Paste the output from Step 1
--   3. Click "Run"
--   4. Done! Your schema is copied (without data)
-- =================================================================

-- Generate CREATE TABLE statements for all tables
SELECT 
    'CREATE TABLE IF NOT EXISTS public.' || table_name || ' (' ||
    string_agg(
        column_name || ' ' || 
        CASE 
            WHEN udt_name = 'varchar' THEN 'TEXT'
            WHEN udt_name = 'text' THEN 'TEXT'
            WHEN udt_name = 'char' THEN 'CHAR(' || character_maximum_length || ')'
            WHEN udt_name = 'numeric' THEN 'NUMERIC(' || COALESCE(numeric_precision::text, '10') || ',' || COALESCE(numeric_scale::text, '3') || ')'
            WHEN udt_name = 'timestamptz' THEN 'TIMESTAMPTZ'
            WHEN udt_name = 'timestamp' THEN 'TIMESTAMP'
            WHEN udt_name = 'date' THEN 'DATE'
            WHEN udt_name = 'bool' THEN 'BOOLEAN'
            WHEN udt_name = 'uuid' THEN 'UUID'
            WHEN udt_name = 'jsonb' THEN 'JSONB'
            WHEN udt_name = 'int8' THEN 'BIGINT'
            WHEN udt_name = 'int4' THEN 'INTEGER'
            WHEN udt_name = 'int2' THEN 'SMALLINT'
            ELSE UPPER(udt_name)
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE 
            WHEN column_default IS NOT NULL AND column_default NOT LIKE 'nextval%' THEN ' DEFAULT ' || column_default
            WHEN column_default LIKE 'gen_random_uuid()' THEN ' DEFAULT gen_random_uuid()'
            WHEN column_default LIKE 'now()' THEN ' DEFAULT now()'
            WHEN column_default LIKE 'CURRENT_DATE' THEN ' DEFAULT CURRENT_DATE'
            ELSE ''
        END,
        ', '
        ORDER BY ordinal_position
    ) ||
    ');' as sql_statement
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT IN ('schema_migrations', '_prisma_migrations')
GROUP BY table_name
ORDER BY table_name;

-- Note: This generates basic CREATE TABLE statements
-- For a complete export including functions, triggers, RLS policies, etc.,
-- you should use the COMPLETE_SCHEMA_SETUP.sql file I created earlier,
-- OR use Supabase's built-in migration system.
