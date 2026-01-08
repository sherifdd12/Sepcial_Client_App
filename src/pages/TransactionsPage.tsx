import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import TransactionList from "@/components/transactions/TransactionList";
import TransactionForm from "@/components/transactions/TransactionForm";
import PaymentForm from "@/components/payments/PaymentForm";
import TransactionDetailDialog from "@/components/transactions/TransactionDetailDialog";
import { TransactionExportTemplate } from "@/components/transactions/TransactionExportTemplate";
import { Transaction, Customer } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils-arabic";
import { handleDatabaseError } from "@/lib/errorHandling";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

// --- Supabase API Functions ---
const getTransactions = async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
        .from('transactions')
        .select(`
            id,
            sequence_number,
            customer_id,
            cost_price,
            extra_price,
            amount,
            profit,
            installment_amount,
            start_date,
            number_of_installments,
            remaining_balance,
            status,
            has_legal_case,
            notes,
            created_at,
            legal_case_details,
            court_collection_data,
            customers (id, full_name, mobile_number)
        `);

    if (error) throw new Error(error.message);

    const mappedData = data.map((t: any) => {
        const { customers, ...rest } = t;
        return {
            ...rest,
            customer: customers,
        };
    });

    // Sort by sequence_number as integer in descending order
    return (mappedData as Transaction[]).sort((a, b) => {
        const numA = parseInt(a.sequence_number || '0');
        const numB = parseInt(b.sequence_number || '0');
        return numB - numA;
    });
};

const getDetailedTransactions = async (transactionIds: string[]): Promise<any[]> => {
    const { data, error } = await supabase
        .from('transactions')
        .select(`
            *,
            customers (id, full_name, mobile_number),
            payments (*)
        `)
        .in('id', transactionIds);

    if (error) throw new Error(error.message);

    return data.map((t: any) => {
        const { customers, ...rest } = t;
        return {
            ...rest,
            customer: customers,
        };
    });
};

const getCustomers = async (): Promise<Customer[]> => {
    const { data, error } = await supabase.from('customers').select('*');
    if (error) throw new Error(error.message);
    return data as Customer[];
};

const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at' | 'customerName' | 'mobileNumber'>): Promise<any> => {
    const { data, error } = await supabase.from('transactions').insert([transaction]).select();
    if (error) throw new Error(error.message);
    return data;
};

const addCustomer = async (customer: Omit<Customer, 'id' | 'created_at'>): Promise<any> => {
    const { data, error } = await supabase.from('customers').insert([customer]).select();
    if (error) throw new Error(error.message);
    return data;
};

const updateTransaction = async (transaction: Partial<Transaction>): Promise<any> => {
    // We explicitly exclude fields that shouldn't be updated or are handled separately (like customer object)
    const { id, customer, created_at, sequence_number, attachments, ...updateData } = transaction as any;

    const { data, error } = await supabase.from('transactions').update(updateData).eq('id', id);
    if (error) throw new Error(error.message);
    return data;
};

const deleteTransaction = async (transactionId: string): Promise<any> => {
    const { data, error } = await supabase.from('transactions').delete().eq('id', transactionId);
    if (error) throw new Error(error.message);
    return data;
};

const deleteMultipleTransactions = async (transactionIds: string[]): Promise<any> => {
    const { error } = await supabase.rpc('delete_multiple_transactions', { transaction_ids: transactionIds });
    if (error) throw new Error(error.message);
    return;
};
// --- End Supabase API Functions ---

const DEFAULT_MESSAGE_TEMPLATE = "عزيزي [CustomerName]،\nنود تذكيركم بأن قسطكم بمبلغ [Amount] دينار كويتي مستحق الدفع.\nالرصيد المتبقي: [Balance] دينار كويتي.\nشكرًا لتعاونكم.";


const TransactionsPage = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [searchParams] = useSearchParams();
    const [showForm, setShowForm] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
    const [paymentTransaction, setPaymentTransaction] = useState<Transaction | null>(null);
    const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);
    const [detailedTransactionsForExport, setDetailedTransactionsForExport] = useState<any[]>([]);
    const [exportType, setExportType] = useState<'single' | 'summary'>('summary');
    const { hasPermission } = usePermissions();

    const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
        queryKey: ["transactions"],
        queryFn: getTransactions,
    });

    const { data: customers, isLoading: isLoadingCustomers } = useQuery<Customer[]>({
        queryKey: ["customers"],
        queryFn: getCustomers,
    });

    useEffect(() => {
        if (transactions) {
            const customerId = searchParams.get("customerId");
            if (customerId) {
                setFilteredTransactions(transactions.filter(t => t.customer_id === customerId));
            } else {
                setFilteredTransactions(transactions);
            }
        }
    }, [searchParams, transactions]);

    const addCustomerMutation = useMutation({
        mutationFn: addCustomer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            toast({ title: "تمت إضافة العميل بنجاح" });
        },
        onError: (error: any) => toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" }),
    });

    const addMutation = useMutation({
        mutationFn: addTransaction,
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ["transactions", "dashboardStats"] });
            // Trigger overdue check after adding transaction
            await supabase.rpc('check_overdue_transactions');
            setShowForm(false);
            toast({ title: "تمت إضافة المعاملة بنجاح" });
        },
        onError: (error: any) => toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: updateTransaction,
        onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ["transactions", "dashboardStats"] });
            // Trigger overdue check after updating transaction
            await supabase.rpc('check_overdue_transactions');
            setShowForm(false);
            setEditingTransaction(undefined);
            toast({ title: "تم تحديث المعاملة بنجاح" });
        },
        onError: (error: any) => toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: deleteTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["transactions", "dashboardStats", "payments"] });
            toast({ title: "تم حذف المعاملة بنجاح" });
        },
        onError: (error: any) => toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" }),
    });

    const deleteMultipleMutation = useMutation({
        mutationFn: deleteMultipleTransactions,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["transactions", "dashboardStats", "payments"] });
            toast({ title: "تم حذف المعاملات المحددة بنجاح" });
        },
        onError: (error: any) => toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" }),
    });

    const handleSave = (formData: any) => {
        if (editingTransaction) {
            updateMutation.mutate({ ...formData, id: editingTransaction.id });
        } else {
            // Use snake_case column names to match database
            addMutation.mutate({
                ...formData,
                amount: formData.amount,
                remaining_balance: formData.amount
            });
        }
    };

    const handleSendReminder = (transaction: Transaction) => {
        const template = localStorage.getItem('whatsappMessageTemplate') || DEFAULT_MESSAGE_TEMPLATE;
        const message = template
            .replace('[CustomerName]', 'عميل')
            .replace('[Amount]', formatCurrency(transaction.installment_amount))
            .replace('[Balance]', formatCurrency(transaction.remaining_balance));

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const exportToExcel = async (selectedIds: string[] = []) => {
        if (!filteredTransactions) return;
        setIsExporting(true);
        toast({ title: "جاري تجهيز ملف Excel..." });

        try {
            const idsToExport = selectedIds.length > 0 ? selectedIds : filteredTransactions.map(t => t.id);
            const detailedData = await getDetailedTransactions(idsToExport);

            const workbook = XLSX.utils.book_new();

            // Summary Sheet
            const summaryData = detailedData.map(t => {
                const totalPaid = t.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
                return {
                    "رقم المعاملة": t.sequence_number,
                    "العميل": t.customer?.full_name,
                    "رقم الهاتف": t.customer?.mobile_number,
                    "المبلغ الإجمالي": t.amount,
                    "إجمالي المدفوع": totalPaid,
                    "المبلغ المتبقي": t.remaining_balance,
                    "قيمة القسط": t.installment_amount,
                    "تاريخ البدء": new Date(t.start_date).toLocaleDateString('ar-KW'),
                    "الحالة": t.status === 'active' ? 'نشطة' : t.status === 'completed' ? 'مكتملة' : t.status === 'late' ? 'متاخرة' : t.status,
                    "قضية قانونية": t.has_legal_case ? 'نعم' : 'لا',
                    "ملاحظات قانونية": t.legal_case_details || '-'
                };
            });
            const summarySheet = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summarySheet, "ملخص المعاملات");

            // Detailed Sheet (Payments)
            const paymentsData = detailedData.flatMap(t =>
                t.payments.map((p: any) => ({
                    "رقم المعاملة": t.sequence_number,
                    "العميل": t.customer?.full_name,
                    "تاريخ الدفع": new Date(p.payment_date).toLocaleDateString('ar-KW'),
                    "المبلغ": p.amount,
                    "طريقة الدفع": p.payment_method || '-',
                    "ملاحظات": p.notes || '-'
                }))
            );
            const paymentsSheet = XLSX.utils.json_to_sheet(paymentsData);
            XLSX.utils.book_append_sheet(workbook, paymentsSheet, "سجل الدفعات");

            // Set RTL
            if (!workbook.Workbook) workbook.Workbook = {};
            if (!workbook.Workbook.Views) workbook.Workbook.Views = [];
            workbook.Workbook.Views[0] = { RTL: true };

            XLSX.writeFile(workbook, `transactions_${new Date().toLocaleDateString()}.xlsx`);
            toast({ title: "تم تصدير ملف Excel بنجاح" });
        } catch (error) {
            console.error("Excel Export Error:", error);
            toast({ title: "خطأ في تصدير Excel", variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    };

    const exportToPDF = async (selectedIds: string[] = []) => {
        if (!filteredTransactions) return;

        setIsExporting(true);
        toast({ title: "جاري تجهيز ملف PDF..." });

        try {
            const idsToExport = selectedIds.length > 0 ? selectedIds : filteredTransactions.map(t => t.id);
            const detailedData = await getDetailedTransactions(idsToExport);

            setDetailedTransactionsForExport(detailedData);
            setExportType(idsToExport.length === 1 ? 'single' : 'summary');

            setTimeout(async () => {
                const element = exportRef.current;
                if (!element) return;

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff"
                });

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgProps = pdf.getImageProperties(imgData);
                const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }

                pdf.save(`transactions_${new Date().toLocaleDateString()}.pdf`);
                toast({ title: "تم تصدير ملف PDF بنجاح" });

                // Reset state
                setDetailedTransactionsForExport([]);
            }, 1000);
        } catch (error) {
            console.error("PDF Export Error:", error);
            toast({ title: "خطأ في تصدير PDF", variant: "destructive" });
            setIsExporting(false);
            setDetailedTransactionsForExport([]);
        }
    };

    if (isLoadingTransactions || isLoadingCustomers) return <div>جاري التحميل...</div>;

    return (
        <div>
            {showForm ? (
                <TransactionForm
                    transaction={editingTransaction}
                    customers={customers || []}
                    onSave={handleSave}
                    onCancel={() => {
                        setShowForm(false);
                        setEditingTransaction(undefined);
                    }}
                    isLoading={addMutation.isPending || updateMutation.isPending}
                    onSaveCustomer={addCustomerMutation.mutate}
                    suggestedSequenceNumber={
                        editingTransaction
                            ? undefined
                            : (Math.max(0, ...((transactions || []).map(t => parseInt(t.sequence_number) || 0))) + 1).toString()
                    }
                />
            ) : (
                <>
                    <div className="mb-4 flex gap-2 justify-end">
                        {hasPermission('can_export_data') && (
                            <>
                                <Button variant="outline" onClick={() => exportToExcel()} className="gap-2">
                                    <FileSpreadsheet size={16} />
                                    تصدير Excel
                                </Button>
                                <Button variant="outline" onClick={() => exportToPDF()} className="gap-2" disabled={isExporting}>
                                    {isExporting ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                                    تصدير PDF
                                </Button>
                            </>
                        )}
                    </div>

                    <TransactionList
                        transactions={filteredTransactions}
                        onAddTransaction={() => {
                            setEditingTransaction(undefined);
                            setShowForm(true);
                        }}
                        onEditTransaction={(transaction) => {
                            setEditingTransaction(transaction);
                            setShowForm(true);
                        }}
                        onDeleteTransaction={(id) => deleteMutation.mutate(id)}
                        onDeleteMultipleTransactions={(ids) => deleteMultipleMutation.mutate(ids)}
                        onRecordPayment={(transaction) => setPaymentTransaction(transaction)}
                        onSendReminder={handleSendReminder}
                        onViewTransaction={(transaction) => setViewingTransaction(transaction)}
                        onExportExcel={exportToExcel}
                        onExportPDF={exportToPDF}
                    />
                    {paymentTransaction && (
                        <PaymentForm
                            transaction={paymentTransaction}
                            isOpen={!!paymentTransaction}
                            onClose={() => setPaymentTransaction(null)}
                        />
                    )}
                    <TransactionDetailDialog
                        transaction={viewingTransaction}
                        open={!!viewingTransaction}
                        onOpenChange={(open) => !open && setViewingTransaction(null)}
                    />

                    {/* Hidden Template for PDF Export */}
                    <div className="fixed -left-[9999px] top-0">
                        <div ref={exportRef}>
                            <TransactionExportTemplate
                                transactions={detailedTransactionsForExport}
                                type={exportType}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TransactionsPage;