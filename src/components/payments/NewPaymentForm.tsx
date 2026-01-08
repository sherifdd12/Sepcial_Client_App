import { handleDatabaseError } from "@/lib/errorHandling";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Customer, Transaction, LegalCase, LegalFee } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils-arabic";
import { Check, ChevronsUpDown, ExternalLink, Loader2, Building2, CreditCard, DollarSign, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTapPaymentLink } from "@/services/tapPaymentService";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// --- API Functions ---
const getActiveCustomers = async () => {
  const { data, error } = await supabase.from("customers").select("*").order("full_name");
  if (error) throw new Error(error.message);
  return data || [];
};

const getCustomerTransactions = async (customerId: string) => {
  if (!customerId) return [];
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("customer_id", customerId)
    .gt("remaining_balance", 0); // Only fetch transactions with a remaining balance
  if (error) throw new Error(error.message);
  return data || [];
};

const recordPayment = async (paymentData: {
  transaction_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  payment_method: string;
  legal_case_id?: string | null;
  legal_fee_id?: string | null;
}) => {
  const { data, error } = await supabase.rpc('record_payment', {
    p_transaction_id: paymentData.transaction_id,
    p_amount: paymentData.amount,
    p_payment_date: paymentData.payment_date,
    p_notes: paymentData.notes,
    p_payment_method: paymentData.payment_method,
    p_legal_case_id: paymentData.legal_case_id || null,
    p_legal_fee_id: paymentData.legal_fee_id || null
  });
  if (error) throw new Error(error.message);
  return data as string; // Returns the payment ID
};

// --- Component ---
interface NewPaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewPaymentForm = ({ isOpen, onClose }: NewPaymentFormProps) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("tap");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [selectedLegalCaseId, setSelectedLegalCaseId] = useState<string | null>(null);
  const [selectedLegalFeeId, setSelectedLegalFeeId] = useState<string | null>(null);
  const [isAutoSelected, setIsAutoSelected] = useState(false);

  const { data: customers } = useQuery({
    queryKey: ["activeCustomers"],
    queryFn: getActiveCustomers,
  });

  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["customerTransactions", selectedCustomerId],
    queryFn: () => getCustomerTransactions(selectedCustomerId!),
    enabled: !!selectedCustomerId,
  });

  const { data: legalCases } = useQuery({
    queryKey: ["customerLegalCases", selectedCustomerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_cases")
        .select("id, case_number, opponent")
        .eq("customer_id", selectedCustomerId);
      if (error) throw error;
      return data as LegalCase[] || [];
    },
    enabled: !!selectedCustomerId,
  });

  const { data: legalFees } = useQuery({
    queryKey: ["customerLegalFees", selectedCustomerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_fees")
        .select("id, amount, status, created_at")
        .eq("customer_id", selectedCustomerId)
        .eq("status", "active");
      if (error) throw error;
      return data as LegalFee[] || [];
    },
    enabled: !!selectedCustomerId,
  });

  const paymentMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: async (paymentId) => {
      toast({ title: "تم تسجيل الدفعة بنجاح!" });
      // Trigger overdue check after payment
      await supabase.rpc('check_overdue_transactions');
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
      queryClient.invalidateQueries({ queryKey: ["payment-method-stats"] });
      queryClient.invalidateQueries({ queryKey: ["legal-fees-history"] });

      // Handle File Upload if exists
      if (file && paymentId) {
        setIsUploading(true);
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
          const filePath = `${selectedCustomerId || 'general'}/${fileName}`;
          const bucketName = 'documents';

          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file);

          if (uploadError) {
            console.error("Upload failed:", uploadError);
            toast({
              variant: "destructive",
              title: "فشل رفع المرفق",
              description: "تأكد من وجود 'documents' bucket في Supabase Storage."
            });
          } else {
            await linkAttachment(paymentId, filePath, bucketName, file.name, file.type);
          }
        } catch (err) {
          console.error("Attachment error:", err);
        } finally {
          setIsUploading(false);
          handleClose();
        }
      } else {
        handleClose();
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "خطأ", description: handleDatabaseError(error) });
    }
  });

  useEffect(() => {
    // Reset transaction and legal links when customer changes
    setSelectedTransactionId(null);
    setSelectedLegalCaseId(null);
    setSelectedLegalFeeId(null);
    setIsAutoSelected(false);
  }, [selectedCustomerId]);

  useEffect(() => {
    if (selectedCustomerId && transactions && transactions.length > 0 && !selectedTransactionId) {
      // Sort transactions by date descending to find the latest one
      const sortedTransactions = [...transactions].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const latestTransaction = sortedTransactions[0];

      // If the latest transaction has a legal case, auto-select it
      if (latestTransaction.has_legal_case) {
        setSelectedTransactionId(latestTransaction.id);
        setPaymentMethod("court_collection");
        setIsAutoSelected(true);

        // If there's only one legal case for this customer, auto-select it too
        if (legalCases && legalCases.length === 1) {
          setSelectedLegalCaseId(legalCases[0].id);
        }

        toast({
          title: "تم التحديد التلقائي",
          description: "تم اختيار المعاملة القانونية وطريقة تحصيل المحكمة تلقائياً.",
        });
      }
    }
  }, [selectedCustomerId, transactions, legalCases, selectedTransactionId, toast]);

  const handleClose = () => {
    setSelectedCustomerId(null);
    setSelectedTransactionId(null);
    setAmount("");
    setNotes("");
    setFile(null);
    setPaymentMethod("tap");
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setGeneratedLink(null);
    setSelectedLegalCaseId(null);
    setSelectedLegalFeeId(null);
    onClose();
  };

  const selectedTransaction = transactions?.find(t => t.id === selectedTransactionId);

  const handleSubmit = async () => {
    if (!selectedTransactionId || !amount) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "الرجاء تحديد معاملة وإدخال المبلغ." });
      return;
    }

    try {
      await paymentMutation.mutateAsync({
        transaction_id: selectedTransactionId,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        notes: notes,
        payment_method: paymentMethod,
        legal_case_id: selectedLegalCaseId === "none" ? null : selectedLegalCaseId,
        legal_fee_id: selectedLegalFeeId === "none" ? null : selectedLegalFeeId
      });
    } catch (error) {
      console.error("Payment process failed:", error);
    }
  };

  const handleCreateTapPayment = async () => {
    const customer = (customers as Customer[])?.find(c => c.id === selectedCustomerId);
    if (!customer || !selectedTransaction) return;

    setIsGeneratingLink(true);
    try {
      const names = customer.full_name.split(' ');
      const firstName = names[0] || 'Customer';
      const lastName = names.slice(1).join(' ') || 'User';

      const paymentUrl = await createTapPaymentLink({
        amount: parseFloat(amount) || selectedTransaction.installment_amount,
        currency: "KWD",
        customer: {
          first_name: firstName,
          last_name: lastName,
          email: `${customer.sequence_number}@example.com`,
          phone: {
            country_code: "965",
            number: customer.mobile_number.replace(/\D/g, '').replace(/^965/, ''),
          },
        },
        reference: {
          transaction: selectedTransaction.sequence_number,
        },
        redirect: {
          url: `${window.location.origin}/payment-success`,
        },
        customerId: selectedCustomerId || undefined,
        transactionId: selectedTransactionId || undefined,
      });

      setGeneratedLink(paymentUrl);
      window.open(paymentUrl, "_blank");
      toast({
        title: "تم إنشاء رابط الدفع",
        description: "تم فتح رابط الدفع في نافذة جديدة. يمكنك أيضاً نسخه من الأسفل.",
      });
    } catch (error: unknown) {
      console.error("Error creating payment link:", error);
      toast({
        title: "خطأ في بوابة الدفع (Tap)",
        description: error instanceof Error ? error.message : "فشل في إنشاء رابط الدفع. تأكد من صحة بيانات العميل.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const linkAttachment = async (paymentId: string, filePath: string, bucketName: string, fileName: string, fileType: string) => {
    const { error: dbError } = await supabase
      .from('document_attachments')
      .insert({
        payment_id: paymentId,
        file_path: filePath,
        file_name: fileName,
        file_type: fileType,
        bucket_name: bucketName,
        customer_id: selectedCustomerId,
        transaction_id: selectedTransactionId
      });

    if (dbError) {
      console.error("DB Link failed:", dbError);
      toast({ variant: "destructive", title: "خطأ", description: "تم رفع الملف ولكن فشل ربطه بالدفعة." });
    } else {
      toast({ title: "تم رفع المرفق بنجاح" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>إضافة دفعة جديدة</DialogTitle>
          <DialogDescription>
            اختر العميل والمعاملة ثم أدخل تفاصيل الدفعة.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customer-select">العميل</Label>
            <Popover open={isCustomerOpen} onOpenChange={setIsCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isCustomerOpen}
                  className="w-full justify-between"
                >
                  {selectedCustomerId
                    ? (customers as Customer[])?.find((customer) => customer.id === selectedCustomerId)?.full_name
                    : "اختر العميل..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="ابحث بالاسم، رقم الهاتف، أو رقم العميل..." />
                  <CommandEmpty>لم يتم العثور على عملاء</CommandEmpty>
                  <CommandGroup className="max-h-60 overflow-auto">
                    {(customers as Customer[])?.map((customer) => {
                      const searchValue = `${customer.full_name} ${customer.mobile_number} ${customer.sequence_number}`.toLowerCase();
                      return (
                        <CommandItem
                          key={customer.id}
                          value={searchValue}
                          onSelect={() => {
                            setSelectedCustomerId(customer.id);
                            setIsCustomerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomerId === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{customer.full_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {customer.mobile_number} (رقم العميل: {customer.sequence_number})
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedCustomerId && (
            <>
              <div className="space-y-2">
                <Label htmlFor="transaction-select">المعاملة</Label>
                <Select onValueChange={(val) => {
                  setSelectedTransactionId(val);
                  setIsAutoSelected(false);
                }} value={selectedTransactionId || ""}>
                  <SelectTrigger id="transaction-select" className={cn(isAutoSelected && "border-orange-500 bg-orange-50/50")}>
                    <SelectValue placeholder="اختر المعاملة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingTransactions ? (
                      <SelectItem value="loading" disabled>جاري تحميل المعاملات...</SelectItem>
                    ) : (
                      transactions?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          رقم {t.sequence_number} - متبقي: {formatCurrency(t.remaining_balance)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legal-case-select">القضية (اختياري)</Label>
                  <Select onValueChange={(val) => {
                    setSelectedLegalCaseId(val);
                    setIsAutoSelected(false);
                  }} value={selectedLegalCaseId || "none"}>
                    <SelectTrigger id="legal-case-select" className={cn(isAutoSelected && selectedLegalCaseId !== "none" && "border-orange-500 bg-orange-50/50")}>
                      <SelectValue placeholder="اختر القضية..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون قضية</SelectItem>
                      {legalCases?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.case_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legal-fee-select">الأتعاب (اختياري)</Label>
                  <Select onValueChange={setSelectedLegalFeeId} value={selectedLegalFeeId || "none"}>
                    <SelectTrigger id="legal-fee-select">
                      <SelectValue placeholder="اختر الأتعاب..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون أتعاب</SelectItem>
                      {legalFees?.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {formatCurrency(f.amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {selectedTransaction && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-3">
                <Label>طريقة الدفع</Label>
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                  className="grid grid-cols-1 gap-2"
                >
                  <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="tap" id="tap" />
                    <Label htmlFor="tap" className="flex items-center gap-2 cursor-pointer flex-1">
                      <CreditCard className="h-4 w-4 text-green-600" />
                      <span>تحويل تاب (TapTransfer)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="court_collection" id="court_collection" />
                    <Label htmlFor="court_collection" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Building2 className="h-4 w-4 text-orange-600" />
                      <span>تحصيل محكمة (Court Collection)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-reverse space-x-2 border rounded-md p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="flex items-center gap-2 cursor-pointer flex-1">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <span>أخرى</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">مبلغ الدفعة</Label>
                <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`المبلغ المستحق: ${formatCurrency(selectedTransaction.installment_amount)}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-date">تاريخ الدفعة</Label>
                <Input id="payment-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file-upload">مرفقات (صورة أو ملف PDF)</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                />
                {file && <p className="text-xs text-muted-foreground">تم اختيار: {file.name}</p>}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleCreateTapPayment}
                disabled={isGeneratingLink}
                className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center justify-center gap-2"
              >
                {isGeneratingLink ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                إنشاء رابط دفع وإرساله للعميل (Tap)
              </Button>

              {generatedLink && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-2">
                  <p className="text-xs font-bold text-blue-700">رابط الدفع المباشر:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={generatedLink}
                      className="h-8 text-[10px] bg-white border-blue-200"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink);
                        toast({ title: "تم نسخ الرابط" });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                      onClick={() => window.open(generatedLink, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center text-muted-foreground text-xs">
            تأكد من صحة البيانات قبل الحفظ.
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={!selectedTransactionId || !amount || paymentMutation.isPending || isUploading}>
            {paymentMutation.isPending || isUploading ? "جاري الحفظ..." : "حفظ الدفعة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewPaymentForm;