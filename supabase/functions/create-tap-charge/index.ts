import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
        if (!tapSecretKey) {
            throw new Error('TAP_SECRET_KEY is not set')
        }

        const body = await req.json()

        // Construct the Tap Charge request
        // Documentation: https://developers.tap.company/docs/charges
        const tapResponse = await fetch('https://api.tap.company/v2/charges', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tapSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: body.amount,
                currency: body.currency || 'KWD',
                threeDSecure: true,
                save_card: false,
                customer: {
                    first_name: body.customer.first_name,
                    last_name: body.customer.last_name,
                    email: body.customer.email,
                    phone: body.customer.phone,
                },
                source: { id: 'src_all' },
                redirect: {
                    url: body.redirect.url,
                },
                post: {
                    url: 'https://odeqbnntvogchzipniig.supabase.co/functions/v1/tap-webhook',
                },
                reference: {
                    transaction: body.reference.transaction,
                    order: body.reference.transaction,
                },
                metadata: {
                    app_name: 'QD Installments Pro',
                }
            }),
        })

        const result = await tapResponse.json()

        if (!tapResponse.ok) {
            console.error('Tap API Error:', result)
            return new Response(JSON.stringify({ error: result.errors?.[0]?.description || 'Tap API Error' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: tapResponse.status,
            })
        }

        return new Response(JSON.stringify(result), {
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
