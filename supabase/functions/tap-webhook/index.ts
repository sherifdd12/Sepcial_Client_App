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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const tapSecretKey = Deno.env.get('TAP_SECRET_KEY') ?? ''
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

        const payload = await req.json()
        console.log('Received Tap Webhook:', JSON.stringify(payload, null, 2))

        // 1. SECURE VERIFICATION: Fetch directly from Tap to verify status
        const tapId = payload.id
        if (!tapId) {
            throw new Error('No ID found in payload')
        }

        // Determine if it's an invoice or a charge
        const isInvoice = tapId.startsWith('inv_')
        const endpoint = isInvoice ? `invoices/${tapId}` : `charges/${tapId}`

        const verifyRes = await fetch(`https://api.tap.company/v2/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${tapSecretKey}` }
        })

        if (!verifyRes.ok) {
            throw new Error(`Failed to verify payment with Tap: ${verifyRes.statusText}`)
        }

        const verifiedData = await verifyRes.json()
        const status = verifiedData.status
        const amount = verifiedData.amount
        const currency = verifiedData.currency
        const referenceNo = verifiedData.reference?.transaction || verifiedData.reference?.order

        const customerFirstName = verifiedData.customer?.first_name || ''
        const customerLastName = verifiedData.customer?.last_name || ''
        const customerFullName = `${customerFirstName} ${customerLastName}`.trim()
        const customerEmail = verifiedData.customer?.email || ''
        const customerPhone = verifiedData.customer?.phone?.number || ''

        // 2. Update/Insert into invoices table (for Realtime notifications)
        const { error: invoiceError } = await supabaseClient
            .from('invoices')
            .upsert({
                tap_id: tapId,
                amount: amount,
                currency: currency,
                status: status,
                metadata: verifiedData,
                // Try to get customer/transaction IDs from metadata if they exist
                customer_id: verifiedData.metadata?.customer_id,
                transaction_id: verifiedData.metadata?.transaction_id
            }, { onConflict: 'tap_id' })

        if (invoiceError) console.error('Error updating invoices table:', invoiceError)

        // 3. Auto-linking Logic
        let matchedTransactionId = verifiedData.metadata?.transaction_id || null
        let matchedCustomerId = verifiedData.metadata?.customer_id || null
        let logStatus = 'unmatched'

        // Match by reference number (Transaction Sequence Number)
        if (!matchedTransactionId && referenceNo) {
            const { data: transaction } = await supabaseClient
                .from('transactions')
                .select('id, customer_id')
                .eq('sequence_number', referenceNo)
                .maybeSingle()

            if (transaction) {
                matchedTransactionId = transaction.id
                matchedCustomerId = transaction.customer_id
                logStatus = 'confirmed' // High confidence match
            }
        }

        // Match by phone number if not matched by reference
        if (!matchedTransactionId && customerPhone) {
            const cleanPhone = customerPhone.replace(/\D/g, '').slice(-8)
            if (cleanPhone.length >= 8) {
                const { data: customers } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .or(`mobile_number.ilike.%${cleanPhone}%,phone_number.ilike.%${cleanPhone}%`)
                    .limit(1)

                if (customers && customers.length > 0) {
                    matchedCustomerId = customers[0].id
                    logStatus = 'pending' // Needs review since it's only a phone match

                    // Check if they have exactly one active transaction
                    const { data: transactions } = await supabaseClient
                        .from('transactions')
                        .select('id')
                        .eq('customer_id', matchedCustomerId)
                        .gt('remaining_balance', 0)

                    if (transactions && transactions.length === 1) {
                        matchedTransactionId = transactions[0].id
                    }
                }
            }
        }

        // 4. Log the webhook with matching info
        const { error: logError } = await supabaseClient
            .from('tap_webhook_logs')
            .upsert({
                charge_id: tapId,
                status: logStatus,
                amount: amount,
                currency: currency,
                reference_no: referenceNo,
                customer_name: customerFullName,
                customer_email: customerEmail,
                customer_phone: customerPhone,
                payload: verifiedData,
                matched_transaction_id: matchedTransactionId,
                matched_customer_id: matchedCustomerId,
                processed_at: (status === 'CAPTURED' || status === 'PAID') ? new Date().toISOString() : null
            }, { onConflict: 'charge_id' })

        if (logError) console.error('Error logging webhook:', logError)

        // 5. Auto-record payment disabled (Manual approval required)
        /*
        if (logStatus === 'confirmed' && (status === 'CAPTURED' || status === 'PAID')) {
            const { error: rpcError } = await supabaseClient.rpc('record_payment', {
                p_transaction_id: matchedTransactionId,
                p_amount: amount,
                p_payment_date: new Date().toISOString().split('T')[0],
                p_notes: `Tap Payment (${tapId}) - Auto-confirmed`,
                p_tap_charge_id: tapId
            })
            if (rpcError) console.error('Error auto-recording payment:', rpcError)
        }
        */

        return new Response(JSON.stringify({ success: true, status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Unexpected error in Tap webhook:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
