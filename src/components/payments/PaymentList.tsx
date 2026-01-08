import { useState, useMemo, memo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Payment } from "@/lib/types";
import { formatCurrency, formatArabicDate } from "@/lib/utils-arabic";
import { Trash2, Eye, Search, Edit, MoreHorizontal } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DateFilter from "@/components/shared/DateFilter";

interface PaymentListProps {
    payments: Payment[];
    onDeletePayment: (paymentId: string) => void;
    onDeleteMultiplePayments: (paymentIds: string[]) => void;
    onViewPayment: (payment: Payment) => void;
    onEditPayment: (payment: Payment) => void;
}

const PaymentList = memo(({ payments, onDeletePayment, onDeleteMultiplePayments, onViewPayment, onEditPayment }: PaymentListProps) => {
    const { hasRole } = useAuth();
    const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFilter, setDateFilter] = useState<{ year: number | null; month: number | null }>({ year: null, month: null });

    const filteredPayments = useMemo(() => {
        return payments.filter(
            (payment) => {
                const matchesSearch = (payment.customer?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (payment.customer?.mobile_number || '').includes(searchTerm) ||
                    (payment.transaction?.sequence_number || '').includes(searchTerm);

                let matchesDate = true;
                if (dateFilter.year || dateFilter.month) {
                    if (!payment.payment_date) {
                        matchesDate = false;
                    } else {
                        const paymentDate = new Date(payment.payment_date);
                        const matchesYear = dateFilter.year ? paymentDate.getFullYear() === dateFilter.year : true;
                        const matchesMonth = dateFilter.month ? paymentDate.getMonth() + 1 === dateFilter.month : true;
                        matchesDate = matchesYear && matchesMonth;
                    }
                }

                return matchesSearch && matchesDate;
            }
        );
    }, [payments, searchTerm, dateFilter]);

    const handleSelect = (paymentId: string) => {
        setSelectedPayments((prev) =>
            prev.includes(paymentId)
                ? prev.filter((id) => id !== paymentId)
                : [...prev, paymentId]
        );
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedPayments(filteredPayments.map((p) => p.id));
        } else {
            setSelectedPayments([]);
        }
    };

    const isAllSelected =
        filteredPayments.length > 0 && selectedPayments.length === filteredPayments.length;

    return (
        <div className="space-y-4">
            <div className="flex justify-end items-center">
                {selectedPayments.length > 0 && hasRole("admin") && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="flex items-center space-x-reverse space-x-2">
                                <Trash2 className="h-4 w-4" />
                                <span>حذف المحدد ({selectedPayments.length})</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                    سيتم حذف المدفوعات المحددة ({selectedPayments.length}) نهائياً. هذا الإجراء لن يؤثر على جداول أخرى.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => {
                                        onDeleteMultiplePayments(selectedPayments);
                                        setSelectedPayments([]);
                                    }}
                                >
                                    حذف
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
            <div className="border rounded-lg overflow-hidden shadow-card bg-white">
                <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="البحث بالاسم أو رقم الهاتف أو رقم المعاملة..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pr-10 text-right"
                        />
                    </div>
                    <DateFilter onFilterChange={setDateFilter} />
                </div>
                <div className="overflow-x-auto hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={isAllSelected}
                                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                        aria-label="Select all"
                                        disabled={filteredPayments.length === 0}
                                    />
                                </TableHead>
                                <TableHead className="text-right">العميل</TableHead>
                                <TableHead className="text-right">رقم المعاملة</TableHead>
                                <TableHead className="text-right">المبلغ المدفوع</TableHead>
                                <TableHead className="text-right">طريقة الدفع</TableHead>
                                <TableHead className="text-right">الرصيد بعد الدفعة</TableHead>
                                <TableHead className="text-right">تاريخ الدفع</TableHead>
                                <TableHead className="text-right">الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPayments.length > 0 ? (
                                filteredPayments.map((payment) => (
                                    <TableRow key={payment.id} data-state={selectedPayments.includes(payment.id) && "selected"}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedPayments.includes(payment.id)}
                                                onCheckedChange={() => handleSelect(payment.id)}
                                                aria-label="Select row"
                                            />
                                        </TableCell>
                                        <TableCell>{payment.customer?.full_name || 'غير متوفر'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{payment.transaction?.sequence_number || 'N/A'}</Badge>
                                        </TableCell>
                                        <TableCell className="text-green-600 font-medium">{formatCurrency(payment.amount)}</TableCell>
                                        <TableCell>
                                            {payment.payment_method === 'tap' ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">تحويل تاب</Badge>
                                            ) : payment.payment_method === 'court_collection' ? (
                                                <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">تحصيل محكمة</Badge>
                                            ) : (
                                                <Badge variant="secondary">أخرى</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>{payment.balance_after != null ? formatCurrency(payment.balance_after) : '---'}</TableCell>
                                        <TableCell>{formatArabicDate(new Date(payment.payment_date))}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-reverse space-x-2">
                                                <Button variant="ghost" size="icon" onClick={() => onViewPayment(payment)} title="عرض التفاصيل">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {hasRole('admin') && (
                                                    <Button variant="ghost" size="icon" onClick={() => onEditPayment(payment)} title="تعديل">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {hasRole('admin') && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" title="حذف الدفعة">
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    سيتم حذف هذه الدفعة نهائياً.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => onDeletePayment(payment.id)}>
                                                                    حذف
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                        {searchTerm ? 'لا توجد مدفوعات مطابقة للبحث' : 'لا توجد مدفوعات لعرضها.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4 p-4 bg-gray-50/50">
                    {filteredPayments.length > 0 ? (
                        filteredPayments.map((payment) => (
                            <div key={payment.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="text-xs font-mono">{payment.transaction?.sequence_number || 'N/A'}</Badge>
                                                {payment.payment_method === 'tap' ? (
                                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 text-[10px]">تاب</Badge>
                                                ) : payment.payment_method === 'court_collection' ? (
                                                    <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200 text-[10px]">محكمة</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px]">أخرى</Badge>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-gray-900 text-lg">{payment.customer?.full_name || 'غير متوفر'}</h3>
                                        </div>
                                        <Checkbox
                                            checked={selectedPayments.includes(payment.id)}
                                            onCheckedChange={() => handleSelect(payment.id)}
                                            className="mt-1"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="bg-green-50 p-2 rounded-lg">
                                            <span className="text-green-600 block text-xs mb-1">المبلغ المدفوع</span>
                                            <span className="font-bold text-green-700">{formatCurrency(payment.amount)}</span>
                                        </div>
                                        <div className="bg-gray-50 p-2 rounded-lg">
                                            <span className="text-gray-500 block text-xs mb-1">الرصيد المتبقي</span>
                                            <span className="font-bold text-gray-900">
                                                {payment.balance_after != null ? formatCurrency(payment.balance_after) : '---'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center text-xs text-gray-500 gap-2">
                                        <span>تاريخ الدفع:</span>
                                        <span className="font-medium text-gray-700">{formatArabicDate(new Date(payment.payment_date))}</span>
                                    </div>
                                </div>

                                <div className="bg-gray-50 px-4 py-3 border-t flex justify-between items-center gap-2">
                                    <Button variant="outline" size="sm" className="flex-1 h-10 text-sm" onClick={() => onViewPayment(payment)}>
                                        <Eye className="h-4 w-4 ml-2" />
                                        التفاصيل
                                    </Button>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-10 w-10">
                                                <MoreHorizontal className="h-5 w-5 text-gray-500" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            {hasRole('admin') && (
                                                <>
                                                    <DropdownMenuItem onClick={() => onEditPayment(payment)}>
                                                        <Edit className="h-4 w-4 ml-2" />
                                                        <span>تعديل</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:text-red-600"
                                                        onClick={() => onDeletePayment(payment.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 ml-2" />
                                                        <span>حذف</span>
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                            <p className="text-gray-500">{searchTerm ? 'لا توجد مدفوعات مطابقة' : 'لا توجد مدفوعات'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default PaymentList;