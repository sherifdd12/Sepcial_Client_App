import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Transaction } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { formatArabicDate, formatCurrency } from "@/lib/utils-arabic";
import { Loader as Loader2, FileText, DollarSign, Calendar, User, CircleAlert as AlertCircle, ExternalLink } from "lucide-react";
import AttachmentManager from "@/components/shared/AttachmentManager";
import { createTapPaymentLink } from "@/services/tapPaymentService";
import { useToast } from "@/components/ui/use-toast";

interface TransactionDetailDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TransactionDetailDialog = ({ transaction, open, onOpenChange }: TransactionDetailDialogProps) => {
  const { toast } = useToast();
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [selectedPaymentForAttachments, setSelectedPaymentForAttachments] = useState<any>(null);

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ["transaction-customer", transaction?.customer_id],
    queryFn: async () => {
      if (!transaction?.customer_id) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", transaction.customer_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!transaction?.customer_id && open,
  });

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ["transaction-payments", transaction?.id],
    queryFn: async () => {
      if (!transaction?.id) return [];
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("transaction_id", transaction.id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!transaction?.id && open,
  });

  const { data: allTransactions, isLoading: loadingAllTransactions } = useQuery({
    queryKey: ["customer-all-transactions", transaction?.customer_id],
    queryFn: async () => {
      if (!transaction?.customer_id) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("customer_id", transaction.customer_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!transaction?.customer_id && open,
  });

  const handleCreateTapPayment = async () => {
    if (!customer || !transaction) return;

    setIsGeneratingLink(true);
    try {
      const names = customer.full_name.split(' ');
      const firstName = names[0] || 'Customer';
      const lastName = names.slice(1).join(' ') || 'User';

      const paymentUrl = await createTapPaymentLink({
        amount: transaction.installment_amount,
        currency: "KWD",
        customer: {
          first_name: firstName,
          last_name: lastName,
          email: `${customer.sequence_number}@example.com`, // Placeholder email
          phone: {
            country_code: "965",
            number: customer.mobile_number.replace(/\D/g, ''),
          },
        },
        reference: {
          transaction: transaction.sequence_number,
        },
        redirect: {
          url: `${window.location.origin}/payment-success`,
        },
      });

      window.open(paymentUrl, "_blank");
      toast({
        title: "تم إنشاء رابط الدفع",
        description: "تم فتح رابط الدفع في نافذة جديدة.",
      });
    } catch (error: any) {
      console.error("Error creating payment link:", error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في إنشاء رابط الدفع",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  if (!transaction) return null;

  const totalPaid = payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
  const progressPercentage = transaction.amount > 0 ? (totalPaid / transaction.amount) * 100 : 0;

  const getStatusBadge = () => {
    if (transaction.has_legal_case) {
      return <Badge variant="destructive" className="text-base px-3 py-1">قضية قانونية</Badge>;
    }
    if (transaction.remaining_balance <= 0) {
      return <Badge className="bg-green-600 text-base px-3 py-1">مكتملة</Badge>;
    }
    if (transaction.status === 'overdue') {
      return <Badge variant="secondary" className="text-base px-3 py-1">متأخرة</Badge>;
    }
    return <Badge variant="secondary" className="text-base px-3 py-1">نشطة</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="overflow-y-auto p-4 sm:p-6 max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <FileText className="h-6 w-6" />
              تفاصيل المعاملة
            </DialogTitle>
            <DialogDescription>
              عرض كافة التفاصيل المتعلقة بالمعاملة المختارة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>المعلومات الأساسية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {transaction.sequence_number || 'غير محدد'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">رقم البيع</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge()}
                    <span className="text-sm text-muted-foreground">الحالة</span>
                  </div>
                  {loadingCustomer ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : customer ? (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{customer.full_name}</span>
                        <Badge variant="outline" className="shrink-0">{customer.sequence_number}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">رقم الهاتف:</span>
                        <span>{customer.mobile_number}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatArabicDate(new Date(transaction.start_date))}</span>
                    <span className="text-sm text-muted-foreground">تاريخ البدء</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatArabicDate(new Date(transaction.created_at))}</span>
                    <span className="text-sm text-muted-foreground">تاريخ الإنشاء</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-blue-100 bg-blue-50/30">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <DollarSign className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                    <div className="text-xl font-bold text-blue-700">{formatCurrency(transaction.cost_price)}</div>
                    <div className="text-xs text-blue-600/70 uppercase font-bold">سعر السلعة</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-purple-100 bg-purple-50/30">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <DollarSign className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                    <div className="text-xl font-bold text-purple-700">{formatCurrency(transaction.extra_price)}</div>
                    <div className="text-xs text-purple-600/70 uppercase font-bold">السعر الإضافي</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-100 bg-green-50/30">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <DollarSign className="h-6 w-6 mx-auto text-green-600 mb-2" />
                    <div className="text-xl font-bold text-green-700">{formatCurrency(transaction.amount)}</div>
                    <div className="text-xs text-green-600/70 uppercase font-bold">إجمالي السعر</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-orange-100 bg-orange-50/30">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <DollarSign className="h-6 w-6 mx-auto text-orange-600 mb-2" />
                    <div className="text-xl font-bold text-orange-700">{formatCurrency(transaction.installment_amount)}</div>
                    <div className="text-xs text-orange-600/70 uppercase font-bold">قيمة القسط</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>تفاصيل الدفع</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">عدد الأقساط</div>
                    <div className="text-2xl font-bold">{transaction.number_of_installments}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">المبلغ المدفوع</div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                    <div className="text-xs text-muted-foreground mt-1">إجمالي المبلغ الأصلي: {formatCurrency(transaction.amount)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">المبلغ المتبقي</div>
                    {transaction.remaining_balance < 0 ? (
                      <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                        {formatCurrency(transaction.remaining_balance)}
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-base">دفع غرامة</span>
                      </div>
                    ) : (
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(transaction.remaining_balance)}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>نسبة التحصيل</span>
                    <span className="font-medium">{progressPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
                    />
                  </div>
                </div>

                {transaction.notes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="font-medium text-blue-800 mb-1">ملاحظات</div>
                    <p className="text-sm text-blue-700">{transaction.notes}</p>
                  </div>
                )}

                <Button
                  onClick={handleCreateTapPayment}
                  disabled={isGeneratingLink}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 mt-2"
                >
                  {isGeneratingLink ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  إنشاء رابط دفع (Tap)
                </Button>
              </CardContent>
            </Card>

            {allTransactions && allTransactions.length > 1 && (
              <Card className="border-amber-100 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    معاملات أخرى لهذا العميل ({allTransactions.length - 1})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {allTransactions
                      .filter(t => t.id !== transaction.id)
                      .map(t => (
                        <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded bg-white border border-amber-100 text-xs gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{t.sequence_number}</Badge>
                            <span className="font-medium">{formatCurrency(t.amount)}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">المتبقي:</span>
                              <span className={t.remaining_balance > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                                {formatCurrency(t.remaining_balance)}
                              </span>
                            </div>
                            <Badge variant={t.status === 'completed' ? 'default' : 'secondary'} className={t.status === 'completed' ? 'bg-green-600' : ''}>
                              {t.status === 'completed' ? 'مكتملة' : t.status === 'overdue' ? 'متأخرة' : 'نشطة'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {transaction.has_legal_case && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="h-5 w-5" />
                    تفاصيل القضية القانونية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white rounded-md p-4 border border-red-200">
                      <div className="text-sm font-medium text-red-800 mb-2">حالة القضية</div>
                      <Badge variant="destructive" className="text-base">قضية قانونية نشطة</Badge>
                    </div>

                    {transaction.legal_case_details && (
                      <div className="bg-white rounded-md p-4 border border-red-200">
                        <div className="text-sm font-medium text-red-800 mb-2">تفاصيل القضية</div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{transaction.legal_case_details}</p>
                      </div>
                    )}

                    {transaction.court_collection_data?.details && (
                      <div className="bg-white rounded-md p-4 border border-red-200">
                        <div className="text-sm font-medium text-red-800 mb-2">بيانات تحصيل المحكمة</div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{transaction.court_collection_data.details}</p>
                      </div>
                    )}

                    <div className="bg-white rounded-md p-4 border border-red-200">
                      <div className="text-sm font-medium text-red-800 mb-3">معلومات إضافية</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">رقم المعاملة:</span>
                          <span className="font-medium">{transaction.sequence_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">المبلغ المتبقي:</span>
                          <span className="font-medium text-red-600">{formatCurrency(transaction.remaining_balance)}</span>
                        </div>
                        {transaction.overdue_amount && transaction.overdue_amount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">المبلغ المتأخر:</span>
                            <span className="font-medium text-red-600">{formatCurrency(transaction.overdue_amount)}</span>
                          </div>
                        )}
                        {transaction.overdue_installments && transaction.overdue_installments > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">عدد الأقساط المتأخرة:</span>
                            <span className="font-medium text-red-600">{transaction.overdue_installments}</span>
                          </div>
                        )}

                        <Button
                          onClick={handleCreateTapPayment}
                          disabled={isGeneratingLink}
                          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                        >
                          {isGeneratingLink ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                          إنشاء رابط دفع (Tap)
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  سجل الدفعات ({payments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPayments ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : payments && payments.length > 0 ? (
                  <div className="overflow-hidden">
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">التاريخ</TableHead>
                            <TableHead className="text-right">المبلغ</TableHead>
                            <TableHead className="text-right">الرصيد قبل</TableHead>
                            <TableHead className="text-right">الرصيد بعد</TableHead>
                            <TableHead className="text-right">أتعاب محاماة</TableHead>
                            <TableHead className="text-right">ملاحظات</TableHead>
                            <TableHead className="text-right">المرفقات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>{formatArabicDate(new Date(payment.payment_date))}</TableCell>
                              <TableCell className="text-green-600 font-medium">
                                {formatCurrency(payment.amount)}
                              </TableCell>
                              <TableCell>{formatCurrency(payment.balance_before)}</TableCell>
                              <TableCell>{formatCurrency(payment.balance_after)}</TableCell>
                              <TableCell>
                                -
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {payment.notes || '-'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedPaymentForAttachments(payment)}
                                  className="flex items-center gap-1"
                                >
                                  <FileText className="h-4 w-4" />
                                  عرض
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View for Payments */}
                    <div className="md:hidden space-y-3">
                      {payments.map((payment) => (
                        <div key={payment.id} className="bg-white border rounded-lg p-3 shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-green-600 text-lg">{formatCurrency(payment.amount)}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {formatArabicDate(new Date(payment.payment_date))}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPaymentForAttachments(payment)}
                              className="h-8 text-xs"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              المرفقات
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded">
                            <div>
                              <span className="text-gray-500 block">الرصيد قبل:</span>
                              <span className="font-medium">{formatCurrency(payment.balance_before)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block">الرصيد بعد:</span>
                              <span className="font-medium">{formatCurrency(payment.balance_after)}</span>
                            </div>
                          </div>

                          {payment.notes && (
                            <div className="text-xs text-gray-600 italic border-t pt-2">
                              "{payment.notes}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد دفعات لهذه المعاملة
                  </div>
                )}
              </CardContent>
            </Card>

            <AttachmentManager
              customerId={transaction.customer_id}
              transactionId={transaction.id}
              title={`مرفقات المعاملة ${transaction.sequence_number}`}
            />
          </div>

          <Dialog open={!!selectedPaymentForAttachments} onOpenChange={(open) => !open && setSelectedPaymentForAttachments(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>مرفقات الدفعة - {selectedPaymentForAttachments && formatArabicDate(new Date(selectedPaymentForAttachments.payment_date))}</DialogTitle>
                <DialogDescription>
                  عرض وإدارة المرفقات الخاصة بهذه الدفعة.
                </DialogDescription>
              </DialogHeader>
              {selectedPaymentForAttachments && (
                <AttachmentManager
                  customerId={transaction.customer_id}
                  transactionId={transaction.id}
                  paymentId={selectedPaymentForAttachments.id}
                  title="مرفقات الدفعة"
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionDetailDialog;
