-- DANGER: This script will delete ALL legal case data to allow for a fresh import.
-- Only run this if you want to start over.

-- 1. Clear the new legal_cases table
DELETE FROM public.legal_cases;

-- 2. Reset the legacy fields in the transactions table
UPDATE public.transactions
SET 
    has_legal_case = false,
    legal_case_details = NULL
WHERE has_legal_case = true;

-- 3. (Optional) If you only want to delete a SPECIFIC case by number:
-- DELETE FROM public.legal_cases WHERE case_number = '123456';
-- UPDATE public.transactions SET has_legal_case = false, legal_case_details = NULL WHERE id = 'transaction_uuid_here';
