import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils-arabic";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Download, FileSpreadsheet, Save, RefreshCw, Calendar, User, Search, Filter, Eye } from "lucide-react";
import TransactionDetailDialog from "@/components/transactions/TransactionDetailDialog";
import { Transaction } from "@/lib/types";
import { useSafeToast } from "@/hooks/useSafeToast";
import * as XLSX from "xlsx";
import DateFilter from "@/components/shared/DateFilter";

interface OverdueTransaction {
    id: string;
    sequence_number: string;
    customer_id: string;
    customer_name: string;
    customer_phone: string;
    start_date: string;
    amount: number;
    remaining_balance: number;
    installment_amount: number;
    number_of_installments: number;
    total_paid: number;
    last_payment_date: string | null;
    delay_months: number;
    delay_amount: number;
    notes: string | null;
}

const OverdueTrackingPage = () => {
    const toast = useSafeToast();
    const queryClient = useQueryClient();
    const [editingNotes, setEditingNotes] = useState<{ [key: string]: string }>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'delay_months', direction: 'desc' });
    const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const { data: overdueList, isLoading, refetch } = useQuery({
        queryKey: ["overdue-tracking"],
        queryFn: async () => {
            // Get all transactions with payments
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select(`
                    *,
                    customers (id, full_name, mobile_number),
                    payments (id, amount, payment_date)
                `)
                .gt('remaining_balance', 0);

            if (error) throw error;

            const now = new Date();
            const twoMonthsAgo = new Date();
            twoMonthsAgo.setMonth(now.getMonth() - 2);

            const overdueTransactions: OverdueTransaction[] = [];

            for (const t of transactions) {
                if (!t.start_date) continue;

                const startDate = new Date(t.start_date);
                if (isNaN(startDate.getTime())) continue;

                // Skip if start date hasn't passed yet
                if (startDate > now) continue;

                const payments = t.payments || [];
                const totalPaid = t.amount - t.remaining_balance;

                // Sort payments by date
                const sortedPayments = [...payments].sort((a, b) =>
                    new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
                );

                const lastPaymentDate = sortedPayments.length > 0 ? sortedPayments[0].payment_date : null;
                const lastPaymentDateObj = lastPaymentDate ? new Date(lastPaymentDate) : null;

                // Case 1: No payments at all and start date has passed
                const hasNoPayments = payments.length === 0;

                // Case 2: Last payment was more than 2 months ago
                const lastPaymentTooOld = lastPaymentDateObj && lastPaymentDateObj < twoMonthsAgo;

                if (hasNoPayments || lastPaymentTooOld) {
                    // Calculate delay
                    const referenceDate = lastPaymentDateObj || startDate;
                    const delayMonths = Math.floor(
                        (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
                    );

                    // Calculate expected payments vs actual
                    const monthsSinceStart = Math.floor(
                        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
                    );
                    const expectedPaid = Math.min(monthsSinceStart, t.number_of_installments) * t.installment_amount;
                    const delayAmount = Math.max(0, expectedPaid - totalPaid);

                    overdueTransactions.push({
                        id: t.id,
                        sequence_number: t.sequence_number,
                        customer_id: t.customer_id,
                        customer_name: t.customers?.full_name || 'غير معروف',
                        customer_phone: t.customers?.mobile_number || '',
                        start_date: t.start_date,
                        amount: t.amount,
                        remaining_balance: t.remaining_balance,
                        installment_amount: t.installment_amount,
                        number_of_installments: t.number_of_installments,
                        total_paid: totalPaid,
                        last_payment_date: lastPaymentDate,
                        delay_months: delayMonths,
                        delay_amount: delayAmount,
                        notes: t.notes || null
                    });
                }
            }

            // Sort by sequence number descending (newest transaction first), then by delay months descending
            return overdueTransactions;
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    const [dateFilter, setDateFilter] = useState<{ year: number | null; month: number | null }>({ year: null, month: null });

    const filteredAndSortedList = useMemo(() => {
        if (!overdueList) return [];

        let result = [...overdueList];

        // Filter by Search Term
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(t =>
                t.customer_name.toLowerCase().includes(lowerTerm) ||
                t.customer_phone.includes(lowerTerm) ||
                t.sequence_number.includes(lowerTerm)
            );
        }

        // Filter by Date (Year/Month) based on start_date
        if (dateFilter.year || dateFilter.month) {
            result = result.filter(t => {
                if (!t.start_date) return false;
                const startDate = new Date(t.start_date);
                const matchesYear = dateFilter.year ? startDate.getFullYear() === dateFilter.year : true;
                const matchesMonth = dateFilter.month ? startDate.getMonth() + 1 === dateFilter.month : true;
                return matchesYear && matchesMonth;
            });
        }

        // Sort
        result.sort((a, b) => {
            let aValue: any = a[sortConfig.key as keyof OverdueTransaction];
            let bValue: any = b[sortConfig.key as keyof OverdueTransaction];

            // Handle specific sort keys if needed
            if (sortConfig.key === 'last_payment_date') {
                aValue = a.last_payment_date ? new Date(a.last_payment_date).getTime() : 0;
                bValue = b.last_payment_date ? new Date(b.last_payment_date).getTime() : 0;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [overdueList, searchTerm, sortConfig, dateFilter]);

    // Fetch full transaction details when a row is clicked
    const { data: selectedTransaction } = useQuery({
        queryKey: ["transaction-detail", selectedTransactionId],
        queryFn: async () => {
            if (!selectedTransactionId) return null;
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('id', selectedTransactionId)
                .single();
            if (error) throw error;
            return data as Transaction;
        },
        enabled: !!selectedTransactionId
    });

    const handleViewDetails = (id: string) => {
        setSelectedTransactionId(id);
        setIsDetailOpen(true);
    };

    const updateNotesMutation = useMutation({
        mutationFn: async ({ transactionId, notes }: { transactionId: string; notes: string }) => {
            const { error } = await supabase
                .from('transactions')
                .update({ notes })
                .eq('id', transactionId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["overdue-tracking"] });
            toast.success("تم حفظ الملاحظات بنجاح");
        },
        onError: () => {
            toast.error("فشل حفظ الملاحظات");
        }
    });

    const handleNotesChange = (transactionId: string, notes: string) => {
        setEditingNotes(prev => ({ ...prev, [transactionId]: notes }));
    };

    const handleSaveNotes = (transactionId: string) => {
        const notes = editingNotes[transactionId];
        if (notes !== undefined) {
            updateNotesMutation.mutate({ transactionId, notes });
        }
    };

    const exportToExcel = () => {
        if (!overdueList || overdueList.length === 0) {
            toast.error("لا توجد بيانات للتصدير");
            return;
        }

        const exportData = overdueList.map(t => ({
            'رقم المعاملة': t.sequence_number,
            'اسم العميل': t.customer_name,
            'رقم الهاتف': t.customer_phone,
            'تاريخ البدء': t.start_date ? new Date(t.start_date).toLocaleDateString('ar-KW') : '',
            'إجمالي المديونية': t.amount,
            'المبلغ المدفوع': t.total_paid,
            'المبلغ المتبقي': t.remaining_balance,
            'آخر دفعة': t.last_payment_date ? new Date(t.last_payment_date).toLocaleDateString('ar-KW') : 'لم يدفع',
            'أشهر التأخير': t.delay_months,
            'مبلغ التأخير': t.delay_amount,
            'ملاحظات': t.notes || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "المتأخرين");

        // Auto-size columns
        const maxWidths: number[] = [];
        exportData.forEach(row => {
            Object.values(row).forEach((val, i) => {
                const len = String(val).length;
                maxWidths[i] = Math.max(maxWidths[i] || 10, len + 2);
            });
        });
        worksheet['!cols'] = maxWidths.map(w => ({ wch: w }));

        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `متأخرين_السداد_${today}.xlsx`);
        toast.success("تم تصدير الملف بنجاح");
    };

    const summary = useMemo(() => {
        if (!filteredAndSortedList) return { count: 0, totalDelay: 0, totalRemaining: 0 };
        return {
            count: filteredAndSortedList.length,
            totalDelay: filteredAndSortedList.reduce((sum, t) => sum + t.delay_amount, 0),
            totalRemaining: filteredAndSortedList.reduce((sum, t) => sum + t.remaining_balance, 0)
        };
    }, [filteredAndSortedList]);

    if (isLoading) {
        return <div className="p-8 text-center">جاري تحميل بيانات المتأخرين...</div>;
    }

    return (
        <div className="space-y-6 p-1 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <AlertTriangle className="h-8 w-8 text-orange-500" />
                        متابعة المتأخرين عن السداد
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        عملاء لم يسددوا لأكثر من شهرين أو لم يسددوا أي قسط بعد بدء المعاملة
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4" />
                        تحديث
                    </Button>
                    <Button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                        <FileSpreadsheet className="h-4 w-4" />
                        تصدير Excel
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-red-50 border-red-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            عدد المتأخرين
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-900">{summary.count} عميل</div>
                    </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            إجمالي مبالغ التأخير
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900">{formatCurrency(summary.totalDelay)}</div>
                    </CardContent>
                </Card>

                <Card className="bg-yellow-50 border-yellow-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            إجمالي المتبقي
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-900">{formatCurrency(summary.totalRemaining)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table */}
            <Card>
                <CardHeader>
                    <CardTitle>قائمة العملاء المتأخرين</CardTitle>
                    <CardDescription>
                        آخر تحديث: {new Date().toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </CardDescription>

                    <div className="flex flex-col md:flex-row gap-4 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث باسم العميل، رقم الهاتف، أو رقم المعاملة..."
                                className="pr-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <DateFilter onFilterChange={setDateFilter} />
                        <div className="flex items-center gap-2 min-w-[200px]">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select
                                value={sortConfig.key}
                                onValueChange={(value) => setSortConfig({ ...sortConfig, key: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="ترتيب حسب" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="delay_months">أشهر التأخير</SelectItem>
                                    <SelectItem value="delay_amount">مبلغ التأخير</SelectItem>
                                    <SelectItem value="remaining_balance">المبلغ المتبقي</SelectItem>
                                    <SelectItem value="last_payment_date">تاريخ آخر دفعة</SelectItem>
                                    <SelectItem value="customer_name">اسم العميل</SelectItem>
                                    <SelectItem value="sequence_number">رقم المعاملة</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                                title={sortConfig.direction === 'asc' ? "تصاعدي" : "تنازلي"}
                            >
                                {sortConfig.direction === 'asc' ? "↑" : "↓"}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Desktop Table View */}
                    <div className="rounded-md border overflow-x-auto hidden md:block">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-right">العميل</TableHead>
                                    <TableHead className="text-right">رقم المعاملة</TableHead>
                                    <TableHead className="text-right">تاريخ البدء</TableHead>
                                    <TableHead className="text-right">المديونية</TableHead>
                                    <TableHead className="text-right">المدفوع</TableHead>
                                    <TableHead className="text-right">المتبقي</TableHead>
                                    <TableHead className="text-right">آخر دفعة</TableHead>
                                    <TableHead className="text-right">التأخير</TableHead>
                                    <TableHead className="text-right min-w-[200px]">ملاحظات</TableHead>
                                    <TableHead className="text-right w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAndSortedList && filteredAndSortedList.length > 0 ? filteredAndSortedList.map((t) => (
                                    <TableRow key={t.id} className="hover:bg-red-50/50">
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{t.customer_name}</span>
                                                <span className="text-xs text-muted-foreground">{t.customer_phone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{t.sequence_number}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {t.start_date ? formatDate(new Date(t.start_date)) : '---'}
                                        </TableCell>
                                        <TableCell className="font-medium">{formatCurrency(t.amount)}</TableCell>
                                        <TableCell className="text-green-600">{formatCurrency(t.total_paid)}</TableCell>
                                        <TableCell className="text-red-600 font-bold">{formatCurrency(t.remaining_balance)}</TableCell>
                                        <TableCell>
                                            {t.last_payment_date ? (
                                                <span className="text-sm">{formatDate(new Date(t.last_payment_date))}</span>
                                            ) : (
                                                <Badge variant="destructive" className="text-xs">لم يدفع</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="destructive" className="w-fit">
                                                    {t.delay_months} شهر
                                                </Badge>
                                                <span className="text-xs text-red-600 font-medium">
                                                    {formatCurrency(t.delay_amount)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                <Textarea
                                                    placeholder="أضف ملاحظة..."
                                                    className="min-h-[60px] text-sm"
                                                    value={editingNotes[t.id] ?? t.notes ?? ''}
                                                    onChange={(e) => handleNotesChange(t.id, e.target.value)}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleSaveNotes(t.id)}
                                                    disabled={updateNotesMutation.isPending}
                                                    className="w-full"
                                                >
                                                    <Save className="h-3 w-3 ml-1" />
                                                    حفظ
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleViewDetails(t.id)}
                                                title="عرض التفاصيل"
                                            >
                                                <Eye className="h-4 w-4 text-blue-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <AlertTriangle className="h-12 w-12 text-green-500" />
                                                <p className="text-lg font-medium text-green-700">لا يوجد عملاء متأخرين! 🎉</p>
                                                <p className="text-sm">جميع العملاء ملتزمون بالسداد</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                        {filteredAndSortedList && filteredAndSortedList.length > 0 ? filteredAndSortedList.map((t) => (
                            <div key={t.id} className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="text-xs font-mono">{t.sequence_number}</Badge>
                                                <Badge variant="destructive" className="text-[10px]">{t.delay_months} شهر تأخير</Badge>
                                            </div>
                                            <h3 className="font-bold text-gray-900 text-lg">{t.customer_name}</h3>
                                            <p className="text-sm text-gray-500">{t.customer_phone}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleViewDetails(t.id)}
                                            className="h-8 w-8"
                                        >
                                            <Eye className="h-5 w-5 text-blue-600" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                                            <span className="text-red-600 block text-xs mb-1">المبلغ المتبقي</span>
                                            <span className="font-bold text-red-700">{formatCurrency(t.remaining_balance)}</span>
                                        </div>
                                        <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                                            <span className="text-orange-600 block text-xs mb-1">مبلغ التأخير</span>
                                            <span className="font-bold text-orange-700">{formatCurrency(t.delay_amount)}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100">
                                        <div className="flex items-center gap-1">
                                            <span>آخر دفعة:</span>
                                            <span className="font-medium text-gray-700">
                                                {t.last_payment_date ? formatDate(new Date(t.last_payment_date)) : 'لم يدفع'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span>المدفوع:</span>
                                            <span className="font-medium text-green-600">{formatCurrency(t.total_paid)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <div className="flex gap-2">
                                            <Textarea
                                                placeholder="ملاحظات..."
                                                className="min-h-[40px] text-sm resize-none"
                                                value={editingNotes[t.id] ?? t.notes ?? ''}
                                                onChange={(e) => handleNotesChange(t.id, e.target.value)}
                                            />
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => handleSaveNotes(t.id)}
                                                disabled={updateNotesMutation.isPending}
                                                className="h-auto w-10 shrink-0"
                                            >
                                                <Save className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
                                <AlertTriangle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                                <p className="text-gray-600 font-medium">لا يوجد عملاء متأخرين</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            <TransactionDetailDialog
                transaction={selectedTransaction || null}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
            />
        </div>
    );
};

export default OverdueTrackingPage;
