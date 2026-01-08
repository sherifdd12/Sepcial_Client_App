import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PaymentList from "@/components/payments/PaymentList";
import NewPaymentForm from "@/components/payments/NewPaymentForm";
import { Payment } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleDatabaseError } from "@/lib/errorHandling";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import PaymentDetailDialog from "@/components/payments/PaymentDetailDialog";
import PaymentEditDialog from "@/components/payments/PaymentEditDialog";
import { useAuth } from "@/hooks/useAuth";

// --- Supabase API Functions ---
const getPayments = async (startDate: Date | null) => {
    let query = supabase
        .from('payments')
        .select(`
            *,
            customer:customers (full_name),
            transaction:transactions (sequence_number, amount, remaining_balance)
        `)
        .order('payment_date', { ascending: false });

    if (startDate) {
        query = query.gte('payment_date', startDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data;
};

const deletePayment = async (paymentId: string) => {
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);
    if (error) throw new Error(error.message);
};

const deleteMultiplePayments = async (paymentIds: string[]) => {
    const { error } = await supabase.rpc('delete_multiple_payments', { payment_ids: paymentIds });
    if (error) throw new Error(error.message);
};
// --- End Supabase API Functions ---

const PaymentsPage = () => {
    const { isReadOnly } = useAuth();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [isNewPaymentFormOpen, setIsNewPaymentFormOpen] = useState(false);

    // Default to last 1 year
    const [startDate, setStartDate] = useState<Date | null>(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d;
    });

    const { data: payments, isLoading, isError } = useQuery({
        queryKey: ["payments", startDate],
        queryFn: () => getPayments(startDate),
    });

    const deleteMutation = useMutation({
        mutationFn: deletePayment,
        onSuccess: () => {
            toast({ title: "تم حذف الدفعة بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["payments", "transactions", "dashboardStats"] });
        },
        onError: (error: any) => {
            toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" });
        },
    });

    const deleteMultipleMutation = useMutation({
        mutationFn: deleteMultiplePayments,
        onSuccess: () => {
            toast({ title: "تم حذف المدفوعات المحددة بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["payments", "transactions", "dashboardStats"] });
        },
        onError: (error: any) => {
            toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" });
        },
    });

    if (isLoading) return <div>جاري تحميل المدفوعات...</div>;
    if (isError) return <div>خطأ في تحميل المدفوعات</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">المدفوعات</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <p>عرض وإدارة كافة المدفوعات المسجلة</p>
                        {startDate && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                (آخر سنة)
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {startDate && (
                        <Button
                            variant="outline"
                            onClick={() => setStartDate(null)}
                            className="flex items-center space-x-reverse space-x-2"
                        >
                            <span>تحميل الكل</span>
                        </Button>
                    )}
                    <Button
                        onClick={() => setIsNewPaymentFormOpen(true)}
                        className="flex items-center space-x-reverse space-x-2"
                        disabled={isReadOnly}
                    >
                        <Plus className="h-4 w-4" />
                        <span>إضافة دفعة جديدة</span>
                    </Button>
                </div>
            </div>

            <PaymentList
                payments={payments as any || []}
                onDeletePayment={(paymentId) => deleteMutation.mutate(paymentId)}
                onDeleteMultiplePayments={(paymentIds) => deleteMultipleMutation.mutate(paymentIds)}
                onViewPayment={(payment) => setViewingPayment(payment)}
                onEditPayment={(payment) => setEditingPayment(payment)}
            />

            <PaymentDetailDialog
                payment={viewingPayment}
                open={!!viewingPayment}
                onOpenChange={(open) => !open && setViewingPayment(null)}
            />

            <PaymentEditDialog
                payment={editingPayment}
                open={!!editingPayment}
                onOpenChange={(open) => !open && setEditingPayment(null)}
            />

            <NewPaymentForm
                isOpen={isNewPaymentFormOpen}
                onClose={() => setIsNewPaymentFormOpen(false)}
            />
        </div>
    );
};

export default PaymentsPage;