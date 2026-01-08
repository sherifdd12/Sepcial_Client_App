import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, Edit, Save, X, Calculator, Receipt, Wallet, Wrench, Home, TrendingUp, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils-arabic";
import AttachmentManager from "@/components/shared/AttachmentManager";

const CATEGORIES = [
    { id: 'salaries', label: 'الرواتب', icon: Wallet },
    { id: 'equipment', label: 'شراء معدات', icon: Calculator },
    { id: 'repairs_ink', label: 'تصليحات وأحبار', icon: Wrench },
    { id: 'rent_internet', label: 'إيجار وإنترنت', icon: Home },
    { id: 'other', label: 'مصاريف أخرى', icon: Receipt },
];

const ExpensesManager = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<any>(null);
    const [selectedExpenseForAttachments, setSelectedExpenseForAttachments] = useState<any>(null);

    const { data: expenses, isLoading } = useQuery({
        queryKey: ["expenses"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("expenses")
                .select("*")
                .order("expense_date", { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const addMutation = useMutation({
        mutationFn: async (newExpense: any) => {
            const { data, error } = await (supabase as any).from("expenses").insert([newExpense]).select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
            toast({ title: "تم إضافة المصروف بنجاح" });
            setIsDialogOpen(false);
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (expense: any) => {
            const { data, error } = await (supabase as any)
                .from("expenses")
                .update(expense)
                .eq("id", expense.id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
            toast({ title: "تم تحديث المصروف بنجاح" });
            setIsDialogOpen(false);
            setEditingExpense(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any).from("expenses").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
            toast({ title: "تم حذف المصروف" });
        },
    });

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            category: formData.get("category"),
            amount: parseFloat(formData.get("amount") as string),
            expense_date: formData.get("expense_date"),
            notes: formData.get("notes"),
        };

        if (editingExpense) {
            updateMutation.mutate({ ...data, id: editingExpense.id });
        } else {
            addMutation.mutate(data);
        }
    };

    const calculateTotals = () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthly = expenses?.filter((e: any) => {
            const d = new Date(e.expense_date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).reduce((sum: number, e: any) => sum + e.amount, 0) || 0;

        const annual = expenses?.filter((e: any) => {
            const d = new Date(e.expense_date);
            return d.getFullYear() === currentYear;
        }).reduce((sum: number, e: any) => sum + e.amount, 0) || 0;

        return { monthly, annual };
    };

    const getCategoryTotal = (categoryId: string) => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthly = expenses?.filter((e: any) => {
            const d = new Date(e.expense_date);
            return e.category === categoryId && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).reduce((sum: number, e: any) => sum + e.amount, 0) || 0;

        const annual = expenses?.filter((e: any) => {
            const d = new Date(e.expense_date);
            return e.category === categoryId && d.getFullYear() === currentYear;
        }).reduce((sum: number, e: any) => sum + e.amount, 0) || 0;

        return { monthly, annual };
    };

    const totals = calculateTotals();

    return (
        <div className="space-y-6 p-6 bg-gray-50 rounded-xl min-h-screen" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">ادارة المصروفات</h2>
                    <p className="text-gray-500">تتبع وإدارة جميع مصروفات العمل</p>
                </div>
                <Button onClick={() => { setEditingExpense(null); setIsDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة مصروف
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-blue-600 text-white">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-blue-100 text-sm">إجمالي مصاريف الشهر الحالي</p>
                                <h3 className="text-3xl font-bold mt-1">{formatCurrency(totals.monthly)}</h3>
                            </div>
                            <Calculator className="h-10 w-10 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-indigo-700 text-white">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-indigo-100 text-sm">إجمالي مصاريف السنة الحالية</p>
                                <h3 className="text-3xl font-bold mt-1">{formatCurrency(totals.annual)}</h3>
                            </div>
                            <TrendingUp className="h-10 w-10 opacity-20" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {CATEGORIES.map((cat) => {
                    const catTotals = getCategoryTotal(cat.id);
                    return (
                        <Card key={cat.id} className="border-none shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <cat.icon className="h-4 w-4 text-blue-600" />
                                    {cat.label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500">شهري: <span className="font-bold text-gray-800">{formatCurrency(catTotals.monthly)}</span></p>
                                    <p className="text-xs text-gray-500">سنوي: <span className="font-bold text-gray-800">{formatCurrency(catTotals.annual)}</span></p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {expenses?.map((expense: any) => (
                    <div key={expense.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                    {CATEGORIES.find(c => c.id === expense.category)?.icon &&
                                        (() => {
                                            const Icon = CATEGORIES.find(c => c.id === expense.category)!.icon;
                                            return <Icon className="h-5 w-5" />;
                                        })()
                                    }
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900">{CATEGORIES.find(c => c.id === expense.category)?.label}</h4>
                                    <div className="text-sm text-gray-500">{expense.expense_date}</div>
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setSelectedExpenseForAttachments(expense)}>
                                        <Paperclip className="mr-2 h-4 w-4" />
                                        المرفقات
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setEditingExpense(expense); setIsDialogOpen(true); }}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        تعديل
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => deleteMutation.mutate(expense.id)} className="text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        حذف
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                            <span className="text-sm text-gray-500">المبلغ</span>
                            <span className="font-bold text-lg text-red-600">{formatCurrency(expense.amount)}</span>
                        </div>

                        {expense.notes && (
                            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                                {expense.notes}
                            </div>
                        )}

                        <Button
                            variant="outline"
                            className="w-full mt-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                            onClick={() => { setEditingExpense(expense); setIsDialogOpen(true); }}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            عرض التفاصيل
                        </Button>
                    </div>
                ))}
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>سجل المصروفات</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr className="border-b text-gray-500 text-sm">
                                        <th className="p-3">التاريخ</th>
                                        <th className="p-3">الفئة</th>
                                        <th className="p-3">المبلغ</th>
                                        <th className="p-3">ملاحظات</th>
                                        <th className="p-3">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses?.map((expense: any) => (
                                        <tr key={expense.id} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="p-3">{expense.expense_date}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                                                    {CATEGORIES.find(c => c.id === expense.category)?.label}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-red-600">{formatCurrency(expense.amount)}</td>
                                            <td className="p-3 text-gray-500 text-sm">{expense.notes || "-"}</td>
                                            <td className="p-3">
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => setSelectedExpenseForAttachments(expense)} title="المرفقات">
                                                        <Paperclip className="h-4 w-4 text-blue-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => { setEditingExpense(expense); setIsDialogOpen(true); }}>
                                                        <Edit className="h-4 w-4 text-gray-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(expense.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingExpense ? "تعديل مصروف" : "إضافة مصروف جديد"}</DialogTitle>
                        <DialogDescription>أدخل تفاصيل المصروف أدناه.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">الفئة</Label>
                            <Select name="category" defaultValue={editingExpense?.category || "other"}>
                                <SelectTrigger className="text-right">
                                    <SelectValue placeholder="اختر الفئة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">المبلغ</Label>
                            <Input id="amount" name="amount" type="number" step="0.001" defaultValue={editingExpense?.amount} required className="text-right" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expense_date">التاريخ</Label>
                            <Input id="expense_date" name="expense_date" type="date" defaultValue={editingExpense?.expense_date || new Date().toISOString().split('T')[0]} required className="text-right" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Input id="notes" name="notes" defaultValue={editingExpense?.notes} className="text-right" />
                        </div>
                        <DialogFooter className="flex gap-2 justify-start pt-4">
                            <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                                {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                                حفظ
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Attachments Dialog */}
            <Dialog open={!!selectedExpenseForAttachments} onOpenChange={(open) => !open && setSelectedExpenseForAttachments(null)}>
                <DialogContent className="sm:max-w-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>مرفقات المصروف</DialogTitle>
                    </DialogHeader>
                    {selectedExpenseForAttachments && (
                        <AttachmentManager
                            expenseId={selectedExpenseForAttachments.id}
                            title={`مرفقات: ${selectedExpenseForAttachments.notes || 'بدون عنوان'}`}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ExpensesManager;
