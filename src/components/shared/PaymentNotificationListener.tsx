import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils-arabic";
import { useNavigate } from "react-router-dom";

export const PaymentNotificationListener = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handlePayment = (payload: any) => {
            const status = payload.new.status;
            if (status !== "PAID" && status !== "CAPTURED") return;

            // Play a sound
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
            audio.play().catch(() => { });

            const metadata = payload.new.metadata || {};
            const customerName = metadata.customer?.first_name
                ? `${metadata.customer.first_name} ${metadata.customer.last_name || ""}`.trim()
                : "عميل";

            toast.success(`تم استلام دفعة من ${customerName}`, {
                description: `المبلغ: ${formatCurrency(payload.new.amount)}`,
                duration: 10000,
                action: {
                    label: "عرض التفاصيل",
                    onClick: () => navigate("/tap-payments"),
                },
            });
        };

        const channel = supabase
            .channel("global-payments")
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "invoices",
                },
                handlePayment
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "invoices",
                },
                handlePayment
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [navigate]);

    return null;
};
