-- =================================================================
-- EXPORT SCHEMA FROM OLD SUPABASE DATABASE
-- =================================================================
-- INSTRUCTIONS:
-- 1. Open your OLD Supabase project (the one with your data)
-- 2. Go to SQL Editor
-- 3. Run this script
-- 4. Copy the output (it will show CREATE statements for all tables, functions, etc.)
-- 5. Paste it into your NEW Supabase project's SQL Editor
-- =================================================================

-- This query generates CREATE TABLE statements for all your tables
SELECT 
    'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' (' ||
    string_agg(
        column_name || ' ' || 
        CASE 
            WHEN data_type = 'character varying' THEN 'TEXT'
            WHEN data_type = 'character' THEN 'CHAR(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'NUMERIC(' || numeric_precision || ',' || numeric_scale || ')'
            WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
            WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
            WHEN data_type = 'date' THEN 'DATE'
            WHEN data_type = 'boolean' THEN 'BOOLEAN'
            WHEN data_type = 'uuid' THEN 'UUID'
            WHEN data_type = 'jsonb' THEN 'JSONB'
            WHEN data_type = 'bigint' THEN 'BIGINT'
            WHEN data_type = 'integer' THEN 'INTEGER'
            WHEN data_type = 'text' THEN 'TEXT'
            ELSE UPPER(data_type)
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE 
            WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ', '
        ORDER BY ordinal_position
    ) ||
    ');' as create_table_statement
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT IN ('schema_migrations')
GROUP BY schemaname, tablename
ORDER BY tablename;

-- =================================================================
-- BETTER METHOD: Use pg_dump via Supabase SQL Editor
-- =================================================================
-- Actually, the above won't work perfectly. Let me give you a better solution:
