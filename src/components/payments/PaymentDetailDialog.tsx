import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Payment } from "@/lib/types";
import { formatCurrency, formatArabicDate } from "@/lib/utils-arabic";
import AttachmentManager from "@/components/shared/AttachmentManager";
import { Card, CardContent } from "@/components/ui/card";
import { User, Receipt, DollarSign, Calendar, FileText } from "lucide-react";

interface PaymentDetailDialogProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PaymentDetailDialog = ({ payment, open, onOpenChange }: PaymentDetailDialogProps) => {
  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <Card className="border-none shadow-lg overflow-hidden">
            <DialogHeader className="p-6 pb-2 bg-primary/5">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                تفاصيل الدفعة
              </DialogTitle>
              <DialogDescription className="text-right">
                عرض تفصيلي للمعلومات المتعلقة بالدفعة المحددة.
              </DialogDescription>
            </DialogHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                {/* Customer Info */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">العميل</span>
                      <span className="font-bold text-foreground">{payment.customer?.full_name}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {payment.transaction?.sequence_number}
                  </Badge>
                </div>

                {/* Amount Card */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-center">
                    <DollarSign className="h-5 w-5 mx-auto text-green-600 mb-1" />
                    <div className="text-lg font-black text-green-700">{formatCurrency(payment.amount)}</div>
                    <div className="text-[10px] text-green-600/70 uppercase font-bold">المبلغ المدفوع</div>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
                    <Calendar className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                    <div className="text-sm font-bold text-blue-700">{formatArabicDate(new Date(payment.payment_date))}</div>
                    <div className="text-[10px] text-blue-600/70 uppercase font-bold">تاريخ الدفع</div>
                  </div>
                </div>

                {/* Balance Details */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground px-1">تفاصيل الرصيد</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col p-3 rounded-lg border border-dashed">
                      <span className="text-[10px] text-muted-foreground">الرصيد قبل</span>
                      <span className="font-semibold">{formatCurrency(payment.balance_before)}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-lg border border-dashed">
                      <span className="text-[10px] text-muted-foreground">الرصيد بعد</span>
                      <span className="font-semibold">{formatCurrency(payment.balance_after)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {payment.notes && (
                  <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-bold text-amber-700">ملاحظات</span>
                    </div>
                    <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                      {payment.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <AttachmentManager
                  customerId={payment.customer_id}
                  transactionId={payment.transaction_id}
                  paymentId={payment.id}
                  title="مرفقات الدفعة"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDetailDialog;