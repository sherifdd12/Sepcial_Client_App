import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Customer } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils-arabic";
import { Loader2, Gavel, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BalanceAdjustmentDialogProps {
    customer: Customer;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentBalance: number;
    onSuccess: () => void;
}

const BalanceAdjustmentDialog = ({ customer, open, onOpenChange, currentBalance, onSuccess }: BalanceAdjustmentDialogProps) => {
    const [amount, setAmount] = useState(currentBalance > 0 ? currentBalance.toString() : "0");
    const [type, setType] = useState<"refund" | "legal_fees">("refund");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleAdjustment = async () => {
        const adjAmount = parseFloat(amount);
        if (isNaN(adjAmount) || adjAmount <= 0) {
            toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
            return;
        }

        if (adjAmount > currentBalance && currentBalance > 0) {
            if (!confirm("المبلغ المدخل أكبر من الرصيد المتوفر. هل تريد المتابعة؟")) {
                return;
            }
        }

        setLoading(true);
        try {
            const { error } = await supabase.from("customer_balance_adjustments").insert({
                customer_id: customer.id,
                amount: adjAmount,
                type: type,
                notes: notes,
                created_by: (await supabase.auth.getUser()).data.user?.id
            });

            if (error) throw error;

            toast({
                title: "تم بنجاح",
                description: type === "refund" ? "تم تسجيل عملية الإرجاع بنجاح" : "تم خصم أتعاب المحاماة بنجاح"
            });
            onSuccess();
            onOpenChange(false);
            setNotes("");
            setAmount("0");
        } catch (error: any) {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>إدارة مستحقات العميل: {customer.full_name}</DialogTitle>
                    <DialogDescription>
                        يمكنك إرجاع مبلغ للعميل أو خصم أتعاب محاماة من رصيده الزائد.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className={`p-3 rounded-md border mb-2 ${currentBalance > 0 ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-100"}`}>
                        <div className={`text-sm mb-1 ${currentBalance > 0 ? "text-blue-600" : "text-gray-600"}`}>الرصيد الزائد الحالي:</div>
                        <div className={`text-xl font-bold ${currentBalance > 0 ? "text-blue-700" : "text-gray-700"}`}>{formatCurrency(currentBalance)}</div>
                    </div>

                    <div className="grid gap-2">
                        <Label>نوع العملية</Label>
                        <Select value={type} onValueChange={(v: any) => setType(v)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="refund">
                                    <div className="flex items-center gap-2">
                                        <RefreshCcw className="h-4 w-4 text-blue-600" />
                                        <span>إرجاع مبلغ (Refund)</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="legal_fees">
                                    <div className="flex items-center gap-2">
                                        <Gavel className="h-4 w-4 text-orange-600" />
                                        <span>أتعاب محاماة (Legal Fees)</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="amount">المبلغ</Label>
                        <Input
                            id="amount"
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.000"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">ملاحظات</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="أضف أي ملاحظات إضافية هنا..."
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        إلغاء
                    </Button>
                    <Button onClick={handleAdjustment} disabled={loading} className={type === "refund" ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}>
                        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        {type === "refund" ? "تأكيد الإرجاع" : "خصم الأتعاب"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default BalanceAdjustmentDialog;
