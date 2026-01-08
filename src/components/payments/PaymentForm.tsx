import { handleDatabaseError } from "@/lib/errorHandling";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils-arabic";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, CreditCard, DollarSign } from "lucide-react";

interface PaymentFormProps {
  transaction: Transaction;
  isOpen: boolean;
  onClose: () => void;
}

// Supabase RPC call
const recordPayment = async ({ transactionId, amount, notes, paymentMethod }: { transactionId: string; amount: number; notes: string; paymentMethod: string; }) => {
  const { error } = await supabase.rpc('record_payment', {
    p_transaction_id: transactionId,
    p_amount: amount,
    p_payment_date: new Date().toISOString().split('T')[0], // Use today's date
    p_notes: notes,
    p_payment_method: paymentMethod
  });
  if (error) throw new Error(error.message);
  return { success: true };
};

const PaymentForm = ({ transaction, isOpen, onClose }: PaymentFormProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState(transaction.installment_amount || 0);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("tap");

  const { mutate, isPending } = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      toast({ title: "تم تسجيل الدفعة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      queryClient.invalidateQueries({ queryKey: ["payment-method-stats"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-payments", transaction.id] });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction || !amount || amount <= 0) {
      toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح.", variant: "destructive" });
      return;
    }

    mutate({ transactionId: transaction.id, amount: Number(amount), notes, paymentMethod });
  };

  const penalty = transaction.remaining_balance > 0 && amount > transaction.remaining_balance ? amount - transaction.remaining_balance : 0;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة للمعاملة</DialogTitle>
          <DialogDescription>
            العميل: {transaction.customer?.full_name} | المبلغ المتبقي: {formatCurrency(transaction.remaining_balance)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>طريقة الدفع</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              className="grid grid-cols-1 gap-2"
            >
              <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="tap" id="p-tap" />
                <Label htmlFor="p-tap" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <span>تحويل تاب (TapTransfer)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="court_collection" id="p-court_collection" />
                <Label htmlFor="p-court_collection" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Building2 className="h-4 w-4 text-orange-600" />
                  <span>تحصيل محكمة (Court Collection)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="other" id="p-other" />
                <Label htmlFor="p-other" className="flex items-center gap-2 cursor-pointer flex-1">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span>أخرى</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ</Label>
            <Input
              id="amount"
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات على الدفعة (اختياري)"
            />
          </div>
          {penalty > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                <strong>تنبيه:</strong> المبلغ المدفوع يتجاوز المبلغ المتبقي
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                المبلغ الإضافي (أتعاب محاماة): {formatCurrency(penalty)}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>إلغاء</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "جاري الحفظ..." : "حفظ الدفعة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentForm;