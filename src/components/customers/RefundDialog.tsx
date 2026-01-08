import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Customer } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils-arabic";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RefundDialogProps {
    customer: Customer;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentBalance: number;
    onSuccess: () => void;
}

const RefundDialog = ({ customer, open, onOpenChange, currentBalance, onSuccess }: RefundDialogProps) => {
    const [amount, setAmount] = useState(currentBalance.toString());
    const [reason, setReason] = useState("إرجاع رصيد زائد");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleRefund = async () => {
        const refundAmount = parseFloat(amount);
        if (isNaN(refundAmount) || refundAmount <= 0) {
            toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
            return;
        }

        if (refundAmount > currentBalance) {
            if (!confirm("المبلغ المدخل أكبر من الرصيد الزائد المتوفر. هل تريد المتابعة؟")) {
                return;
            }
        }

        setLoading(true);
        try {
            const { error } = await (supabase as any).from("refunds").insert({
                customer_id: customer.id,
                amount: refundAmount,
                reason: reason,
                refund_date: new Date().toISOString().split('T')[0]
            });

            if (error) throw error;

            toast({ title: "تم بنجاح", description: "تم تسجيل عملية الإرجاع بنجاح" });
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>إرجاع مبلغ للعميل: {customer.full_name}</DialogTitle>
                    <DialogDescription>
                        تسجيل عملية إرجاع مبلغ مالي للعميل من رصيده الزائد.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100 mb-2">
                        <div className="text-sm text-blue-600 mb-1">الرصيد الزائد المتوفر:</div>
                        <div className="text-xl font-bold text-blue-700">{formatCurrency(currentBalance)}</div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="amount">المبلغ المراد إرجاعه</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.000"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="reason">سبب الإرجاع / ملاحظات</Label>
                        <Textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="مثال: إرجاع فائض تحصيل المحكمة"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        إلغاء
                    </Button>
                    <Button onClick={handleRefund} disabled={loading}>
                        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        تأكيد الإرجاع
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RefundDialog;
