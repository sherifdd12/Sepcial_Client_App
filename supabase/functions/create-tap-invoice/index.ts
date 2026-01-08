import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const tapSecretKey = Deno.env.get('TAP_SECRET_KEY')
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!tapSecretKey || !supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing environment variables')
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const body = await req.json()

        console.log('Request body:', JSON.stringify(body, null, 2))

        const { amount, currency, customer, reference, redirect, customerId, transactionId } = body

        // 1. Create Charge via Tap API
        // Documentation: https://developers.tap.company/docs/charges
        const tapResponse = await fetch('https://api.tap.company/v2/charges', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tapSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amount,
                currency: currency || 'KWD',
                threeDSecure: true,
                save_card: false,
                description: `Payment for Transaction ${reference.transaction}`,
                statement_descriptor: 'QD INSTALLMENTS',
                metadata: {
                    app_name: 'QD Installments Pro',
                    customer_id: customerId,
                    transaction_id: transactionId,
                    transaction_seq: reference.transaction
                },
                reference: {
                    transaction: reference.transaction,
                    order: reference.transaction,
                },
                customer: {
                    first_name: customer.first_name,
                    last_name: customer.last_name,
                    email: customer.email,
                    phone: customer.phone,
                },
                source: { id: "src_all" },
                post: {
                    url: `${supabaseUrl}/functions/v1/tap-webhook`,
                },
                redirect: {
                    url: redirect.url,
                },
            }),
        })

        const result = await tapResponse.json()

        if (!tapResponse.ok) {
            console.error('Tap API Error:', JSON.stringify(result, null, 2))
            const errorMessage = result.errors?.[0]?.description || result.message || 'Tap API Error';
            return new Response(JSON.stringify({ error: errorMessage, details: result }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: tapResponse.status,
            })
        }

        // 2. Save to Supabase invoices table (we still use the invoices table to track charges)
        const { error: dbError } = await supabase.from('invoices').insert({
            tap_id: result.id,
            amount: amount,
            currency: currency || 'KWD',
            status: result.status,
            customer_id: customerId,
            transaction_id: transactionId,
            metadata: result
        })

        if (dbError) {
            console.error('Database Error:', dbError)
        }

        return new Response(JSON.stringify({
            id: result.id,
            url: result.transaction.url,
            status: result.status
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Error creating Tap charge:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
