-- Migration script to move data from transactions.legal_case_details to legal_cases table

DO $$
DECLARE
    trans_record RECORD;
    case_block TEXT;
    v_case_number TEXT;
    v_automated_number TEXT;
    v_entity TEXT;
    v_circle_number TEXT;
    v_opponent TEXT;
    v_session_date TEXT;
    v_session_decision TEXT;
    v_next_session_date TEXT;
    v_amount_due TEXT;
    v_notes TEXT;
BEGIN
    FOR trans_record IN 
        SELECT id, customer_id, legal_case_details 
        FROM transactions 
        WHERE legal_case_details IS NOT NULL AND legal_case_details != ''
    LOOP
        -- Split by the separator if multiple updates exist, take the latest one (usually at the end)
        -- Or iterate through all blocks. Let's iterate through all blocks.
        FOR case_block IN SELECT unnest(string_to_array(trans_record.legal_case_details, '--- تحديث من ملف قضايا'))
        LOOP
            IF case_block IS NOT NULL AND case_block ~ 'رقم القضية:' THEN
                -- Extract fields using regex
                v_case_number := (regexp_match(case_block, 'رقم القضية:\s*(.*)'))[1];
                v_automated_number := (regexp_match(case_block, 'الرقم الآلي:\s*(.*)'))[1];
                v_entity := (regexp_match(case_block, 'الجهة:\s*(.*)'))[1];
                v_circle_number := (regexp_match(case_block, 'الدائرة:\s*(.*)'))[1];
                v_opponent := (regexp_match(case_block, 'الخصم:\s*(.*)'))[1];
                v_session_date := (regexp_match(case_block, 'تاريخ الجلسة:\s*(.*)'))[1];
                v_session_decision := (regexp_match(case_block, 'قرار الجلسة:\s*(.*)'))[1];
                v_next_session_date := (regexp_match(case_block, 'تاريخ الجلسة القادمة:\s*(.*)'))[1];
                v_amount_due := (regexp_match(case_block, 'المبلغ:\s*(.*)'))[1];
                v_notes := (regexp_match(case_block, 'ملاحظات:\s*(.*)'))[1];

                -- Clean up "undefined" or "غير متوفر" strings
                IF v_case_number = 'undefined' THEN v_case_number := v_automated_number; END IF;
                IF v_case_number = 'غير محدد' THEN v_case_number := v_automated_number; END IF;
                
                -- Insert into legal_cases if we have at least a case number or automated number
                IF (v_case_number IS NOT NULL AND v_case_number != '') OR (v_automated_number IS NOT NULL AND v_automated_number != '') THEN
                    INSERT INTO legal_cases (
                        customer_id,
                        transaction_id,
                        case_number,
                        automated_number,
                        entity,
                        circle_number,
                        opponent,
                        session_date,
                        session_decision,
                        next_session_date,
                        amount_due,
                        notes
                    ) VALUES (
                        trans_record.customer_id,
                        trans_record.id,
                        COALESCE(v_case_number, v_automated_number, 'Unknown'),
                        v_automated_number,
                        v_entity,
                        v_circle_number,
                        v_opponent,
                        v_session_date,
                        v_session_decision,
                        v_next_session_date,
                        v_amount_due,
                        v_notes
                    )
                    ON CONFLICT (case_number) DO NOTHING; -- Avoid duplicates if run multiple times
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;
