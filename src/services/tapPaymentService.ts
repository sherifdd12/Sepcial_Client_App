import { supabase } from "@/integrations/supabase/client";

export interface TapChargeRequest {
    amount: number;
    currency: string;
    customer: {
        first_name: string;
        last_name: string;
        email: string;
        phone: {
            country_code: string;
            number: string;
        };
    };
    reference: {
        transaction: string; // This is our Transaction Sequence Number
    };
    redirect: {
        url: string;
    };
    customerId?: string;
    transactionId?: string;
}

export const createTapPaymentLink = async (params: TapChargeRequest): Promise<string> => {
    // We use 'create-tap-charge' to match the user's existing function name
    const { data, error } = await supabase.functions.invoke("create-tap-charge", {
        body: params,
    });

    if (error) throw error;
    if (!data?.url) throw new Error("فشل في الحصول على رابط الدفع من تاب");

    return data.url;
};

export const getTapWebhookLogs = async () => {
    const { data, error } = await (supabase as any)
        .from("tap_webhook_logs")
        .select(`
            *,
            transaction:matched_transaction_id (
                sequence_number,
                remaining_balance
            ),
            customer:matched_customer_id (
                full_name,
                mobile_number
            )
        `)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
};
