import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Payment } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleDatabaseError } from "@/lib/errorHandling";
import AttachmentManager from "@/components/shared/AttachmentManager";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, CreditCard, DollarSign } from "lucide-react";

interface PaymentEditDialogProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PaymentEditDialog = ({ payment, open, onOpenChange }: PaymentEditDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<any>({
    amount: 0,
    payment_date: '',
    notes: '',
    payment_method: 'tap',
  });

  useEffect(() => {
    if (payment) {
      setFormData({
        amount: payment.amount,
        payment_date: payment.payment_date ? new Date(payment.payment_date).toISOString().split('T')[0] : '',
        notes: payment.notes || '',
        payment_method: payment.payment_method || 'tap',
      });
    }
  }, [payment]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("payments")
        .update({
          amount: data.amount,
          payment_date: data.payment_date,
          notes: data.notes,
          payment_method: data.payment_method,
        })
        .eq("id", payment?.id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تم تحديث بيانات الدفعة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      queryClient.invalidateQueries({ queryKey: ["payment-method-stats"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل بيانات الدفعة</DialogTitle>
          <DialogDescription>
            تحديث تفاصيل الدفعة المالية المختارة.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Label>طريقة الدفع</Label>
            <RadioGroup
              value={formData.payment_method}
              onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
              className="grid grid-cols-1 gap-2"
            >
              <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="tap" id="edit-tap" />
                <Label htmlFor="edit-tap" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CreditCard className="h-4 w-4 text-green-600" />
                  <span>تحويل تاب (TapTransfer)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="court_collection" id="edit-court_collection" />
                <Label htmlFor="edit-court_collection" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Building2 className="h-4 w-4 text-orange-600" />
                  <span>تحصيل محكمة (Court Collection)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="other" id="edit-other" />
                <Label htmlFor="edit-other" className="flex items-center gap-2 cursor-pointer flex-1">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span>أخرى</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="amount">المبلغ المدفوع *</Label>
            <Input
              id="amount"
              type="number"
              step="0.001"
              value={formData.amount || ""}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              required
            />
          </div>
          <div>
            <Label htmlFor="payment_date">تاريخ الدفع *</Label>
            <Input
              id="payment_date"
              type="date"
              value={formData.payment_date || ""}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </form>

        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-semibold mb-3">المرفقات</h4>
          <AttachmentManager
            customerId={payment.customer_id}
            transactionId={payment.transaction_id}
            paymentId={payment.id}
            title="مرفقات الدفعة"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentEditDialog;
