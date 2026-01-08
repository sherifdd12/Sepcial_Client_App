import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Gavel, Plus, History, Loader2, Search, RotateCcw, MoreHorizontal } from "lucide-react";
import { formatCurrency } from "@/lib/utils-arabic";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LegalFee } from "@/lib/types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LegalFeeManager = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [selectedTransactionId, setSelectedTransactionId] = useState<string>("");
    const [amount, setAmount] = useState<string>("500");
    const [notes, setNotes] = useState<string>("");
    const [bypassRule, setBypassRule] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Fetch customers
    const { data: customers } = useQuery({
        queryKey: ["customers-legal-fees"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("customers")
                .select("id, full_name, civil_id")
                .order("full_name");
            if (error) throw error;
            return data;
        },
    });

    // Fetch transactions for selected customer
    const { data: transactions } = useQuery({
        queryKey: ["transactions-legal-fees", selectedCustomerId],
        queryFn: async () => {
            if (!selectedCustomerId) return [];
            const { data, error } = await supabase
                .from("transactions")
                .select("id, sequence_number, amount, status")
                .eq("customer_id", selectedCustomerId)
                .neq("status", "completed");
            if (error) throw error;
            return data;
        },
        enabled: !!selectedCustomerId,
    });

    // Fetch existing legal fees for customer
    const { data: existingFees, isLoading: isLoadingFees } = useQuery({
        queryKey: ["legal-fees-history", selectedCustomerId],
        queryFn: async () => {
            if (!selectedCustomerId) return [];
            const { data, error } = await supabase
                .from("legal_fees")
                .select("*, transactions(sequence_number)")
                .eq("customer_id", selectedCustomerId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data as unknown as LegalFee[];
        },
        enabled: !!selectedCustomerId,
    });

    const hasActiveFee = existingFees?.some(fee => fee.status === 'active');

    const addFeeMutation = useMutation({
        mutationFn: async () => {
            if (!selectedCustomerId) throw new Error("يرجى اختيار العميل");
            if (!amount || isNaN(Number(amount))) throw new Error("يرجى إدخال مبلغ صحيح");

            if (hasActiveFee && !bypassRule) {
                throw new Error("هذا العميل لديه أتعاب قانونية نشطة بالفعل. يرجى تفعيل خيار التجاوز للمتابعة.");
            }

            const { error } = await supabase.from("legal_fees").insert({
                customer_id: selectedCustomerId,
                transaction_id: selectedTransactionId || null,
                amount: Number(amount),
                notes: notes,
                status: "active"
            });

            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "تم إضافة الأتعاب بنجاح" });
            setAmount("500");
            setNotes("");
            setBypassRule(false);
            queryClient.invalidateQueries({ queryKey: ["legal-fees-history"] });
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
        },
        onError: (error: Error) => {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        }
    });

    const refundFeeMutation = useMutation({
        mutationFn: async (feeId: string) => {
            const { error } = await supabase
                .from("legal_fees")
                .update({ status: 'refunded' })
                .eq("id", feeId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "تم استرجاع الأتعاب بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["legal-fees-history"] });
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
        },
        onError: (error: Error) => {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        }
    });

    const filteredCustomers = customers?.filter(c =>
        c.full_name.includes(searchQuery) || (c.civil_id && c.civil_id.includes(searchQuery))
    ).slice(0, 10);

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-gray-100">
                <CardHeader className="bg-gray-50/50 border-b pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-700">
                        <Plus className="h-5 w-5" />
                        إضافة أتعاب قانونية جديدة
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                        <Label>البحث عن عميل</Label>
                        <div className="relative">
                            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="ابحث بالاسم أو الرقم المدني..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                        </div>
                        {searchQuery && (
                            <div className="border rounded-md mt-1 bg-white shadow-sm overflow-hidden">
                                {filteredCustomers?.map(c => (
                                    <div
                                        key={c.id}
                                        className={cn(
                                            "p-2 hover:bg-blue-50 cursor-pointer text-sm",
                                            selectedCustomerId === c.id && "bg-blue-100"
                                        )}
                                        onClick={() => {
                                            setSelectedCustomerId(c.id);
                                            setSearchQuery(c.full_name);
                                        }}
                                    >
                                        {c.full_name} - {c.civil_id || 'بدون رقم مدني'}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>المعاملة المرتبطة (اختياري)</Label>
                        <Select value={selectedTransactionId} onValueChange={setSelectedTransactionId}>
                            <SelectTrigger>
                                <SelectValue placeholder={selectedCustomerId ? "اختر المعاملة" : "يرجى اختيار عميل أولاً"} />
                            </SelectTrigger>
                            <SelectContent>
                                {transactions?.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.sequence_number} - {formatCurrency(t.amount)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>المبلغ (د.ك)</Label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="500"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="سبب إضافة الأتعاب..."
                        />
                    </div>

                    {hasActiveFee && (
                        <Alert className="bg-amber-50 border-amber-200">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertTitle className="text-amber-800">تنبيه: أتعاب نشطة</AlertTitle>
                            <AlertDescription className="text-amber-700">
                                هذا العميل لديه أتعاب قانونية نشطة بالفعل. هل أنت متأكد من إضافة أتعاب إضافية؟
                            </AlertDescription>
                            <div className="flex items-center gap-2 mt-2">
                                <Checkbox
                                    id="bypass"
                                    checked={bypassRule}
                                    onCheckedChange={(checked) => setBypassRule(checked as boolean)}
                                />
                                <Label htmlFor="bypass" className="text-xs text-amber-900 cursor-pointer">تجاوز القاعدة والمتابعة</Label>
                            </div>
                        </Alert>
                    )}

                    <Button
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => addFeeMutation.mutate()}
                        disabled={addFeeMutation.isPending || (hasActiveFee && !bypassRule)}
                    >
                        {addFeeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4 ml-2" />}
                        تسجيل الأتعاب
                    </Button>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-gray-100">
                <CardHeader className="bg-gray-50/50 border-b pb-4">
                    <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-700">
                        <History className="h-5 w-5" />
                        سجل الأتعاب للعميل
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    {!selectedCustomerId ? (
                        <div className="text-center py-12 text-gray-400">
                            <Search className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>اختر عميلاً لعرض سجل الأتعاب الخاص به</p>
                        </div>
                    ) : isLoadingFees ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : existingFees?.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>لا يوجد سجل أتعاب لهذا العميل</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden">
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right">التاريخ</TableHead>
                                            <TableHead className="text-right">المبلغ</TableHead>
                                            <TableHead className="text-right">الحالة</TableHead>
                                            <TableHead className="text-right">إجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {existingFees?.map(fee => (
                                            <TableRow key={fee.id}>
                                                <TableCell className="text-xs">
                                                    {new Date(fee.created_at).toLocaleDateString('ar-KW')}
                                                </TableCell>
                                                <TableCell className="font-bold">{formatCurrency(fee.amount)}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={fee.status === 'active' ? 'destructive' : fee.status === 'paid' ? 'default' : 'secondary'}
                                                        className={cn(fee.status === 'paid' && "bg-green-600 hover:bg-green-700 text-white")}
                                                    >
                                                        {fee.status === 'active' ? 'نشط' :
                                                            fee.status === 'paid' ? 'مدفوع' : 'مسترجع'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {fee.status !== 'refunded' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                            onClick={() => {
                                                                if (confirm("هل أنت متأكد من استرجاع هذه الأتعاب؟")) {
                                                                    refundFeeMutation.mutate(fee.id);
                                                                }
                                                            }}
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                                {existingFees?.map(fee => (
                                    <div key={fee.id} className="bg-white border rounded-lg p-3 shadow-sm space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-gray-900">{formatCurrency(fee.amount)}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {new Date(fee.created_at).toLocaleDateString('ar-KW')}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={fee.status === 'active' ? 'destructive' : fee.status === 'paid' ? 'default' : 'secondary'}
                                                    className={cn("text-xs", fee.status === 'paid' && "bg-green-600 hover:bg-green-700 text-white")}
                                                >
                                                    {fee.status === 'active' ? 'نشط' :
                                                        fee.status === 'paid' ? 'مدفوع' : 'مسترجع'}
                                                </Badge>
                                                {fee.status !== 'refunded' && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => {
                                                                    if (confirm("هل أنت متأكد من استرجاع هذه الأتعاب؟")) {
                                                                        refundFeeMutation.mutate(fee.id);
                                                                    }
                                                                }}
                                                                className="text-amber-600"
                                                            >
                                                                <RotateCcw className="mr-2 h-4 w-4" />
                                                                استرجاع
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </div>
                                        {fee.transactions && (
                                            <div className="text-xs bg-gray-50 p-2 rounded text-gray-600">
                                                مرتبط بالمعاملة: #{fee.transactions.sequence_number}
                                            </div>
                                        )}
                                        {fee.notes && (
                                            <div className="text-xs text-gray-500 italic border-t pt-2">
                                                "{fee.notes}"
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default LegalFeeManager;
