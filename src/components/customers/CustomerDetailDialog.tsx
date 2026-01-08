import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Customer } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { formatArabicDate, formatCurrency } from "@/lib/utils-arabic";
import { Loader as Loader2, User, Phone, CreditCard, Calendar, DollarSign, FileText, RefreshCcw } from "lucide-react";
import AttachmentManager from "@/components/shared/AttachmentManager";
import RefundDialog from "./RefundDialog";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface CustomerDetailDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CustomerDetailDialog = ({ customer, open, onOpenChange }: CustomerDetailDialogProps) => {
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  const { data: balance, refetch: refetchBalance } = useQuery({
    queryKey: ["customer-balance", customer?.id],
    queryFn: async () => {
      if (!customer?.id) return 0;
      const { data, error } = await supabase.rpc("get_customer_balance", {
        p_customer_id: customer.id,
      });
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!customer?.id && open,
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ["customer-transactions", customer?.id],
    queryFn: async () => {
      if (!customer?.id) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customer?.id && open,
  });

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["customer-payments", customer?.id],
    queryFn: async () => {
      if (!customer?.id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*, transactions(sequence_number)")
        .eq("customer_id", customer.id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customer?.id && open,
  });

  const { data: legalFees } = useQuery({
    queryKey: ["customer-legal-fees", customer?.id],
    queryFn: async () => {
      if (!customer?.id) return [];
      const { data, error } = await supabase
        .from("legal_fees")
        .select("*")
        .eq("customer_id", customer.id);
      if (error) throw error;
      return data;
    },
    enabled: !!customer?.id && open,
  });

  if (!customer) return null;

  const totalDebt = transactions?.reduce((sum, t) => sum + (Number(t.remaining_balance) || 0), 0) || 0;
  const totalPaid = payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
  const totalAmount = transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

  const getStatusBadge = (transaction: any) => {
    if (transaction.has_legal_case) {
      return <Badge variant="destructive">قضية قانونية</Badge>;
    }
    if (transaction.remaining_balance <= 0) {
      return <Badge className="bg-green-600">مكتملة</Badge>;
    }
    if (transaction.status === 'overdue') {
      return <Badge variant="secondary">متأخرة</Badge>;
    }
    return <Badge variant="secondary">نشطة</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-4xl p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <User className="h-6 w-6" />
            تفاصيل العميل
          </DialogTitle>
          <DialogDescription>
            عرض كافة البيانات المالية والمعاملات الخاصة بالعميل.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                المعلومات الأساسية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">رقم العميل</span>
                  <Badge variant="outline" className="text-xl font-mono px-4 py-1 bg-white mx-auto block w-fit">
                    {customer.sequence_number || 'غير محدد'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-2xl text-gray-900">{customer.full_name}</h3>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground dir-ltr">
                    <Phone className="h-4 w-4" />
                    <span className="text-lg">{customer.mobile_number || '-'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center gap-2">
                    <div className="p-2 rounded-full bg-purple-50 text-purple-600">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted-foreground block">الرقم المدني</span>
                      <span className="font-mono font-medium">{customer.civil_id || '-'}</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center gap-2">
                    <div className="p-2 rounded-full bg-orange-50 text-orange-600">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted-foreground block">تاريخ التسجيل</span>
                      <span className="font-medium">{formatArabicDate(new Date(customer.created_at))}</span>
                    </div>
                  </div>
                </div>

                {customer.alternate_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-gray-50 px-3 py-1 rounded-full">
                    <Phone className="h-3 w-3" />
                    <span>هاتف بديل: {customer.alternate_phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-blue-100 bg-blue-50/30">
              <CardContent className="pt-6">
                <div className="text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <div className="text-2xl font-black text-blue-700">{formatCurrency(totalAmount)}</div>
                  <div className="text-xs text-blue-600/70 uppercase font-bold">إجمالي المعاملات</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-100 bg-green-50/30">
              <CardContent className="pt-6">
                <div className="text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <div className="text-2xl font-black text-green-700">{formatCurrency(totalPaid)}</div>
                  <div className="text-xs text-green-600/70 uppercase font-bold">إجمالي المدفوع</div>
                </div>
              </CardContent>
            </Card>
            <Card className={balance && balance > 0 ? "border-blue-500 bg-blue-50/50 shadow-md" : balance && balance < 0 ? "border-red-500 bg-red-50/50 shadow-md" : "border-gray-200 bg-gray-50/50"}>
              <CardContent className="pt-6">
                <div className="text-center">
                  {balance && balance > 0 ? (
                    <RefreshCcw className="h-8 w-8 mx-auto mb-2 text-blue-600 animate-pulse" />
                  ) : (
                    <DollarSign className={`h-8 w-8 mx-auto mb-2 ${balance && balance < 0 ? "text-red-600" : "text-muted-foreground"}`} />
                  )}
                  <div className={`text-2xl font-black ${balance && balance > 0 ? "text-blue-700" : balance && balance < 0 ? "text-red-700" : "text-muted-foreground"}`}>
                    {formatCurrency(Math.abs(balance || 0))}
                  </div>
                  <div className="text-xs uppercase font-bold opacity-70">
                    {balance && balance > 0 ? "رصيد زائد (له)" : balance && balance < 0 ? "المبلغ المتبقي (عليه)" : "الحساب مصفر"}
                  </div>
                  {balance && balance > 0 && (
                    <button
                      onClick={() => setRefundDialogOpen(true)}
                      className="mt-3 text-xs bg-blue-600 text-white px-4 py-1.5 rounded-full font-bold hover:bg-blue-700 transition-all shadow-sm"
                    >
                      إرجاع مبلغ
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                المعاملات ({transactions?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTransactions ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : transactions && transactions.length > 0 ? (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-right font-bold">رقم البيع</TableHead>
                          <TableHead className="text-right font-bold">المبلغ</TableHead>
                          <TableHead className="text-right font-bold text-orange-600">رسوم قانونية</TableHead>
                          <TableHead className="text-right font-bold">المتبقي</TableHead>
                          <TableHead className="text-right font-bold">الحالة</TableHead>
                          <TableHead className="text-right font-bold">التاريخ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction) => {
                          const transactionLegalFees = legalFees?.filter(f => f.transaction_id === transaction.id)
                            .reduce((sum, f) => sum + (Number(f.amount) || 0), 0) || 0;

                          return (
                            <TableRow key={transaction.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell>
                                <Badge variant="outline" className="font-mono bg-white">{transaction.sequence_number || '-'}</Badge>
                              </TableCell>
                              <TableCell className="font-medium">{formatCurrency(transaction.amount)}</TableCell>
                              <TableCell className={transactionLegalFees > 0 ? "text-orange-600 font-bold" : "text-muted-foreground"}>
                                {formatCurrency(transactionLegalFees)}
                              </TableCell>
                              <TableCell className={transaction.remaining_balance > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                                {formatCurrency(transaction.remaining_balance)}
                              </TableCell>
                              <TableCell>{getStatusBadge(transaction)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatArabicDate(new Date(transaction.created_at))}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {transactions.map((transaction) => {
                      const transactionLegalFees = legalFees?.filter(f => f.transaction_id === transaction.id)
                        .reduce((sum, f) => sum + (Number(f.amount) || 0), 0) || 0;

                      return (
                        <div key={transaction.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-sm px-2 py-1 bg-gray-50">#{transaction.sequence_number}</Badge>
                              {getStatusBadge(transaction)}
                            </div>
                            <span className="text-xs text-muted-foreground bg-gray-50 px-2 py-1 rounded-full">{formatArabicDate(new Date(transaction.created_at))}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50/50 p-3 rounded-lg text-center border border-blue-100">
                              <span className="text-xs text-blue-600/70 block mb-1 font-medium">المبلغ الإجمالي</span>
                              <span className="font-bold text-lg text-blue-700">{formatCurrency(transaction.amount)}</span>
                            </div>
                            <div className={`p-3 rounded-lg text-center border ${transaction.remaining_balance > 0 ? "bg-red-50/50 border-red-100" : "bg-green-50/50 border-green-100"}`}>
                              <span className={`text-xs block mb-1 font-medium ${transaction.remaining_balance > 0 ? "text-red-600/70" : "text-green-600/70"}`}>المبلغ المتبقي</span>
                              <span className={`font-bold text-lg ${transaction.remaining_balance > 0 ? "text-red-700" : "text-green-700"}`}>
                                {formatCurrency(transaction.remaining_balance)}
                              </span>
                            </div>
                            {transactionLegalFees > 0 && (
                              <div className="col-span-2 bg-orange-50 p-2 rounded border border-orange-100 flex justify-between items-center px-4">
                                <span className="text-xs text-orange-600 font-bold">رسوم قانونية</span>
                                <span className="font-bold text-orange-700">{formatCurrency(transactionLegalFees)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد معاملات لهذا العميل
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                الدفعات ({payments?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPayments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : payments && payments.length > 0 ? (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-right font-bold">رقم البيع</TableHead>
                          <TableHead className="text-right font-bold">المبلغ</TableHead>
                          <TableHead className="text-right font-bold">التاريخ</TableHead>
                          <TableHead className="text-right font-bold">ملاحظات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <Badge variant="outline" className="font-mono bg-white">
                                {(payment.transactions as any)?.sequence_number || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-green-600 font-bold">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatArabicDate(new Date(payment.payment_date))}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {payment.notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {payments.map((payment) => (
                      <div key={payment.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                              <DollarSign className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-bold text-lg text-green-700">{formatCurrency(payment.amount)}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono">#{(payment.transactions as any)?.sequence_number || '-'}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="text-xs font-medium text-gray-900">{formatArabicDate(new Date(payment.payment_date))}</div>
                          </div>
                        </div>

                        {payment.notes && (
                          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                            {payment.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد دفعات لهذا العميل
                </div>
              )}
            </CardContent>
          </Card>

          <AttachmentManager customerId={customer.id} title={`مرفقات ${customer.full_name}`} />
        </div>
        <RefundDialog
          customer={customer}
          open={refundDialogOpen}
          onOpenChange={setRefundDialogOpen}
          currentBalance={balance || 0}
          onSuccess={() => {
            refetchBalance();
            toast({ title: "تم تسجيل عملية الإرجاع بنجاح" });
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailDialog;
