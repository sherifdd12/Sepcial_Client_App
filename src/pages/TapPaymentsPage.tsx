import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils-arabic";
import { Check, X, Link as LinkIcon, Loader2, AlertCircle, Info, Search, Filter, Trash2, CheckCircle2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import DateFilter from "@/components/shared/DateFilter";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { useAuth } from "@/hooks/useAuth";

const TapPaymentsPage = () => {
    const { isReadOnly } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [selectedTransactionId, setSelectedTransactionId] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<{ year: number | null; month: number | null }>({ year: null, month: null });
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkApproving, setIsBulkApproving] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Fetch logs
    const { data: logs, isLoading: loadingLogs } = useQuery({
        queryKey: ["tap-webhook-logs"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("tap_webhook_logs")
                .select(`
                    *,
                    matched_transaction:transactions(
                        id,
                        sequence_number,
                        amount,
                        remaining_balance,
                        customer:customers(full_name)
                    ),
                    matched_customer:customers(full_name)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as any[];
        },
    });

    // Fetch active transactions for manual matching
    const { data: activeTransactions } = useQuery({
        queryKey: ["active-transactions-for-matching"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("transactions")
                .select("id, sequence_number, customer:customers(full_name)")
                .eq("status", "active")
                .order("sequence_number");

            if (error) throw error;
            return data;
        },
    });

    // Filter logs
    const filteredLogs = logs?.filter(log => {
        // Date Filter
        if (dateFilter.year || dateFilter.month) {
            const logDate = new Date(log.created_at);
            if (dateFilter.year && logDate.getFullYear() !== dateFilter.year) return false;
            if (dateFilter.month && logDate.getMonth() + 1 !== dateFilter.month) return false;
        }

        // Status Filter
        if (statusFilter !== "all" && log.status !== statusFilter) return false;

        // Search Query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSearch =
                log.customer_name?.toLowerCase().includes(query) ||
                log.customer_phone?.includes(query) ||
                log.reference_no?.toLowerCase().includes(query) ||
                log.charge_id?.toLowerCase().includes(query);
            if (!matchesSearch) return false;
        }

        return true;
    });

    // Confirm Payment Mutation
    const confirmMutation = useMutation({
        mutationFn: async (log: any) => {
            if (!log.matched_transaction_id) throw new Error("يجب ربط الدفعة بمعاملة أولاً");

            // 1. Record the payment
            const { error: rpcError } = await supabase.rpc("record_payment", {
                p_transaction_id: log.matched_transaction_id,
                p_amount: log.amount,
                p_payment_date: new Date().toISOString().split("T")[0],
                p_notes: `تأكيد دفع عبر تاب (ID: ${log.charge_id})`,
                p_tap_charge_id: log.charge_id
            });

            if (rpcError) throw rpcError;

            // 2. Update log status
            const { error: updateError } = await (supabase as any)
                .from("tap_webhook_logs")
                .update({
                    status: "confirmed",
                    processed_at: new Date().toISOString(),
                    processed_by: (await supabase.auth.getUser()).data.user?.id
                })
                .eq("id", log.id);

            if (updateError) throw updateError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tap-webhook-logs"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            toast({ title: "تم التأكيد", description: "تم تسجيل الدفعة بنجاح وتحديث رصيد المعاملة" });
        },
        onError: (error: any) => {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        }
    });

    // Match Mutation
    const matchMutation = useMutation({
        mutationFn: async ({ logId, transactionId }: { logId: string, transactionId: string }) => {
            const { data: transaction } = await supabase
                .from("transactions")
                .select("customer_id")
                .eq("id", transactionId)
                .single();

            const { error } = await (supabase as any)
                .from("tap_webhook_logs")
                .update({
                    matched_transaction_id: transactionId,
                    matched_customer_id: transaction?.customer_id,
                    status: "pending"
                })
                .eq("id", logId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tap-webhook-logs"] });
            setIsMatchDialogOpen(false);
            toast({ title: "تم الربط", description: "تم ربط الدفعة بالمعاملة بنجاح" });
        }
    });

    // Reject Mutation
    const rejectMutation = useMutation({
        mutationFn: async (logId: string) => {
            const { error } = await (supabase as any)
                .from("tap_webhook_logs")
                .update({
                    status: "rejected",
                    processed_at: new Date().toISOString(),
                    processed_by: (await supabase.auth.getUser()).data.user?.id
                })
                .eq("id", logId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tap-webhook-logs"] });
            toast({ title: "تم الرفض", description: "تم تجاهل هذه الدفعة" });
        }
    });

    // Bulk Actions
    const handleBulkApprove = async () => {
        const pendingLogs = filteredLogs?.filter(log => selectedIds.has(log.id) && log.status === "pending") || [];
        if (pendingLogs.length === 0) {
            toast({ title: "لا توجد عمليات قابلة للتأكيد", description: "يرجى اختيار عمليات في حالة 'في انتظار التأكيد'", variant: "destructive" });
            return;
        }

        setIsBulkApproving(true);
        let successCount = 0;
        let errorCount = 0;

        for (const log of pendingLogs) {
            try {
                await confirmMutation.mutateAsync(log);
                successCount++;
            } catch (error) {
                console.error(`Error confirming log ${log.id}:`, error);
                errorCount++;
            }
        }

        setIsBulkApproving(false);
        setSelectedIds(new Set());
        toast({
            title: "اكتملت العملية",
            description: `تم تأكيد ${successCount} عملية بنجاح${errorCount > 0 ? `، وفشل ${errorCount}` : ""}`
        });
    };

    const handleBulkDelete = async () => {
        if (!confirm("هل أنت متأكد من حذف العمليات المختارة؟ لا يمكن التراجع عن هذا الإجراء.")) return;

        setIsBulkDeleting(true);
        try {
            const { error } = await (supabase as any)
                .from("tap_webhook_logs")
                .delete()
                .in("id", Array.from(selectedIds));

            if (error) throw error;

            toast({ title: "تم الحذف", description: `تم حذف ${selectedIds.size} عملية بنجاح` });
            setSelectedIds(new Set());
            queryClient.invalidateQueries({ queryKey: ["tap-webhook-logs"] });
        } catch (error: any) {
            toast({ title: "خطأ في الحذف", description: error.message, variant: "destructive" });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredLogs?.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredLogs?.map(log => log.id)));
        }
    };

    const toggleSelectRow = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending": return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">في انتظار التأكيد</Badge>;
            case "confirmed": return <Badge className="bg-green-600">تم التأكيد</Badge>;
            case "rejected": return <Badge variant="destructive">مرفوضة</Badge>;
            case "unmatched": return <Badge variant="outline" className="text-orange-600 border-orange-600">غير مربوطة</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="container mx-auto py-8 space-y-6 text-right" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">مدفوعات تاب (Tap)</h1>
                    <p className="text-muted-foreground">مراجعة وتأكيد الدفعات الإلكترونية المستلمة</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="relative w-64">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث بالاسم، الهاتف، المرجع..."
                            className="pr-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                            <Filter className="h-4 w-4 ml-2" />
                            <SelectValue placeholder="الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الحالات</SelectItem>
                            <SelectItem value="pending">في انتظار التأكيد</SelectItem>
                            <SelectItem value="confirmed">تم التأكيد</SelectItem>
                            <SelectItem value="rejected">مرفوضة</SelectItem>
                            <SelectItem value="unmatched">غير مربوطة</SelectItem>
                        </SelectContent>
                    </Select>
                    <DateFilter onFilterChange={setDateFilter} />
                </div>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Info className="h-5 w-5 text-blue-600" />
                        سجل العمليات
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingLogs ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
                    ) : (
                        <div className="border rounded-xl overflow-hidden overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={filteredLogs?.length > 0 && selectedIds.size === filteredLogs?.length}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead className="text-right">التاريخ</TableHead>
                                        <TableHead className="text-right">العميل (تاب)</TableHead>
                                        <TableHead className="text-right">المبلغ</TableHead>
                                        <TableHead className="text-right">المرجع (Reference)</TableHead>
                                        <TableHead className="text-right">المعاملة المربوطة</TableHead>
                                        <TableHead className="text-right">الحالة</TableHead>
                                        <TableHead className="text-left">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLogs?.map((log) => (
                                        <TableRow key={log.id} className={cn("hover:bg-muted/30 transition-colors", selectedIds.has(log.id) && "bg-muted/50")}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.has(log.id)}
                                                    onCheckedChange={() => toggleSelectRow(log.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">{formatDate(new Date(log.created_at))}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{log.customer_name || "عميل غير معروف"}</div>
                                                <div className="text-xs text-muted-foreground">{log.customer_phone || log.customer_email}</div>
                                            </TableCell>
                                            <TableCell className="font-bold text-green-600">{formatCurrency(log.amount)}</TableCell>
                                            <TableCell><Badge variant="outline" className="font-mono">{log.reference_no || "بدون"}</Badge></TableCell>
                                            <TableCell>
                                                {log.matched_transaction ? (
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-medium">{log.matched_transaction.customer?.full_name}</div>
                                                        <div className="text-xs text-muted-foreground">رقم: {log.matched_transaction.sequence_number}</div>
                                                        <div className="text-xs text-blue-600">المتبقي: {formatCurrency(log.matched_transaction.remaining_balance)}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground italic text-sm">غير محدد</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {log.status === "pending" && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                className="bg-green-600 hover:bg-green-700 h-8"
                                                                onClick={() => confirmMutation.mutate(log)}
                                                                disabled={confirmMutation.isPending || isReadOnly}
                                                            >
                                                                <Check className="h-3.5 w-3.5 ml-1" /> تأكيد
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                                                                onClick={() => rejectMutation.mutate(log.id)}
                                                                disabled={rejectMutation.isPending || isReadOnly}
                                                            >
                                                                <X className="h-3.5 w-3.5 ml-1" /> رفض
                                                            </Button>
                                                        </>
                                                    )}
                                                    {(log.status === "unmatched" || log.status === "rejected") && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 gap-1"
                                                            onClick={() => {
                                                                setSelectedLog(log);
                                                                setIsMatchDialogOpen(true);
                                                            }}
                                                            disabled={isReadOnly}
                                                        >
                                                            <LinkIcon className="h-3.5 w-3.5" /> ربط يدوي
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredLogs?.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <AlertCircle className="h-8 w-8 opacity-20" />
                                                    <span>لا توجد عمليات تطابق المعايير المختارة</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Match Dialog */}
            <Dialog open={isMatchDialogOpen} onOpenChange={setIsMatchDialogOpen}>
                <DialogContent className="text-right sm:max-w-[425px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>ربط دفعة بمعاملة</DialogTitle>
                        <DialogDescription>
                            اختر المعاملة التي ترغب بربط هذه الدفعة بها. سيتم تحديث رصيد المعاملة بعد التأكيد.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-6">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-2">
                            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">تفاصيل الدفعة المستلمة</div>
                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div>
                                    <div className="text-xs text-muted-foreground">العميل (تاب)</div>
                                    <div className="font-medium">{selectedLog?.customer_name || "غير معروف"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">المبلغ</div>
                                    <div className="font-bold text-green-600">{formatCurrency(selectedLog?.amount || 0)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">المرجع</div>
                                    <div className="font-mono text-sm">{selectedLog?.reference_no || "بدون"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">التاريخ</div>
                                    <div className="text-sm">{selectedLog && formatDate(new Date(selectedLog.created_at))}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold">اختر المعاملة المستهدفة:</label>
                            <Select onValueChange={setSelectedTransactionId} value={selectedTransactionId}>
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder="ابحث عن معاملة أو عميل..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {activeTransactions?.map((t) => (
                                        <SelectItem key={t.id} value={t.id} className="py-3">
                                            <div className="flex flex-col items-start text-right">
                                                <span className="font-bold">{t.customer?.full_name}</span>
                                                <span className="text-xs text-muted-foreground">رقم المعاملة: {t.sequence_number}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="flex-row-reverse gap-3 pt-2">
                        <Button
                            className="flex-1 h-11"
                            onClick={() => matchMutation.mutate({ logId: selectedLog.id, transactionId: selectedTransactionId })}
                            disabled={!selectedTransactionId || matchMutation.isPending}
                        >
                            {matchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إتمام عملية الربط"}
                        </Button>
                        <Button variant="outline" className="flex-1 h-11" onClick={() => setIsMatchDialogOpen(false)}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Action Toolbar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background border shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 border-l pl-6">
                        <span className="text-sm font-bold text-blue-600">{selectedIds.size}</span>
                        <span className="text-sm text-muted-foreground">عمليات مختارة</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 rounded-full px-4"
                            onClick={handleBulkApprove}
                            disabled={isBulkApproving || isReadOnly}
                        >
                            {isBulkApproving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                            تأكيد المختار
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-full px-4"
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting || isReadOnly}
                        >
                            {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Trash2 className="h-4 w-4 ml-2" />}
                            حذف المختار
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            إلغاء
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TapPaymentsPage;
