import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Transaction } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils-arabic";
import { Edit, Trash2, DollarSign, MessageCircle, Eye, Plus, Search, Filter, FileSpreadsheet, FileText, MoreHorizontal } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import DateFilter from "@/components/shared/DateFilter";
import { usePermissions } from "@/hooks/usePermissions";

interface TransactionListProps {
  transactions: Transaction[];
  onAddTransaction: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onDeleteMultipleTransactions: (transactionIds: string[]) => void;
  onRecordPayment: (transaction: Transaction) => void;
  onSendReminder: (transaction: Transaction) => void;
  onViewTransaction: (transaction: Transaction) => void;
  onExportExcel?: (selectedIds: string[]) => void;
  onExportPDF?: (selectedIds: string[]) => void;
}

const TransactionList = ({
  transactions,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onDeleteMultipleTransactions,
  onRecordPayment,
  onSendReminder,
  onViewTransaction,
  onExportExcel,
  onExportPDF,
}: TransactionListProps) => {
  const { hasRole, isReadOnly } = useAuth();
  const { hasPermission } = usePermissions();
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ year: number | null; month: number | null }>({ year: null, month: null });

  const filteredTransactions = transactions.filter(
    (transaction) => {
      const matchesSearch =
        transaction.customer?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.customer?.mobile_number.includes(searchTerm) ||
        transaction.sequence_number?.includes(searchTerm);

      const isCompleted = transaction.remaining_balance <= 0;
      const matchesStatus = showCompleted ? true : !isCompleted;

      let matchesDate = true;
      if (dateFilter.year || dateFilter.month) {
        if (!transaction.start_date) {
          matchesDate = false;
        } else {
          const startDate = new Date(transaction.start_date);
          const matchesYear = dateFilter.year ? startDate.getFullYear() === dateFilter.year : true;
          const matchesMonth = dateFilter.month ? startDate.getMonth() + 1 === dateFilter.month : true;
          matchesDate = matchesYear && matchesMonth;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    }
  );

  const handleSelect = (transactionId: string) => {
    setSelectedTransactions((prev) =>
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTransactions(filteredTransactions.map((t) => t.id));
    } else {
      setSelectedTransactions([]);
    }
  };

  const isAllSelected =
    filteredTransactions.length > 0 &&
    selectedTransactions.length === filteredTransactions.length;

  const getStatusBadge = (transaction: Transaction) => {
    if (transaction.has_legal_case) {
      return <Badge variant="destructive">قضية قانونية</Badge>;
    }
    if (transaction.remaining_balance <= 0) {
      return <Badge className="bg-green-600">مكتملة</Badge>;
    }
    if (transaction.status === 'overdue') {
      return <Badge variant="secondary">متأخرة</Badge>;
    }
    return <Badge variant="default">نشطة</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">المعاملات</h2>
          <p className="text-muted-foreground">عرض وإدارة كافة معاملات التقسيط</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedTransactions.length > 0 && (
            <>
              {hasRole("admin") && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="flex items-center space-x-reverse space-x-2"
                      disabled={isReadOnly}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>حذف المحدد ({selectedTransactions.length})</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف المعاملات المحددة ({selectedTransactions.length}) وجميع المدفوعات المرتبطة بها نهائياً. لا يمكن التراجع عن هذا الإجراء.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onDeleteMultipleTransactions(selectedTransactions);
                          setSelectedTransactions([]);
                        }}
                      >
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {hasPermission('can_export_data') && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-reverse space-x-2"
                    onClick={() => onExportExcel?.(selectedTransactions)}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Excel ({selectedTransactions.length})</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-reverse space-x-2"
                    onClick={() => onExportPDF?.(selectedTransactions)}
                  >
                    <FileText className="h-4 w-4" />
                    <span>PDF ({selectedTransactions.length})</span>
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            onClick={onAddTransaction}
            className="flex items-center space-x-reverse space-x-2"
            disabled={isReadOnly}
          >
            <Plus className="h-4 w-4" />
            <span>إضافة معاملة</span>
          </Button>
        </div>
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
          <div className="flex items-center space-x-reverse space-x-4 bg-muted/30 p-2 rounded-lg border">
            <div className="flex items-center space-x-reverse space-x-2">
              <Switch
                id="show-completed"
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              />
              <Label htmlFor="show-completed" className="cursor-pointer text-sm font-medium">
                عرض المعاملات المكتملة
              </Label>
            </div>
            <div className="h-4 w-[1px] bg-border hidden md:block" />
            <div className="text-xs text-muted-foreground font-medium">
              إجمالي النتائج: {filteredTransactions.length}
            </div>
          </div>
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
                    disabled={filteredTransactions.length === 0}
                  />
                </TableHead>
                <TableHead className="text-right">رقم المعاملة</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">المبلغ الإجمالي</TableHead>
                <TableHead className="text-right">المبلغ المتبقي</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">تبدأ من تاريخ :</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length > 0 ? filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id} data-state={selectedTransactions.includes(transaction.id) && "selected"}>
                  <TableCell>
                    <Checkbox
                      checked={selectedTransactions.includes(transaction.id)}
                      onCheckedChange={() => handleSelect(transaction.id)}
                      aria-label="Select row"
                    />
                  </TableCell>
                  <TableCell><Badge variant="outline">{transaction.sequence_number}</Badge></TableCell>
                  <TableCell>{transaction.customer?.full_name}</TableCell>
                  <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                  <TableCell>
                    {transaction.remaining_balance < 0 ? (
                      <span className="text-green-600 font-bold flex items-center gap-1">
                        {formatCurrency(transaction.remaining_balance)}
                        <Badge variant="success" className="ml-2">دفع غرامة</Badge>
                      </span>
                    ) : (
                      formatCurrency(transaction.remaining_balance)
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(transaction)}</TableCell>
                  <TableCell>{formatDate(new Date(transaction.start_date))}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onViewTransaction(transaction)} title="عرض التفاصيل">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {transaction.status === 'overdue' && (
                        <Button variant="ghost" size="icon" onClick={() => onSendReminder(transaction)} title="إرسال تذكير واتساب">
                          <MessageCircle className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRecordPayment(transaction)}
                        title="تسجيل دفعة"
                        disabled={isReadOnly}
                      >
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </Button>
                      {hasRole('admin') && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditTransaction(transaction)}
                            title="تعديل"
                            disabled={isReadOnly}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="حذف" disabled={isReadOnly}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف هذه المعاملة نهائياً.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDeleteTransaction(transaction.id)}>
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                    {searchTerm ? 'لا توجد معاملات مطابقة للبحث' : 'لا توجد معاملات لعرضها.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4 p-4 bg-gray-50/50">
          {filteredTransactions.length > 0 ? filteredTransactions.map((transaction) => (
            <div key={transaction.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs font-mono">{transaction.sequence_number}</Badge>
                      {getStatusBadge(transaction)}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg">{transaction.customer?.full_name}</h3>
                  </div>
                  <Checkbox
                    checked={selectedTransactions.includes(transaction.id)}
                    onCheckedChange={() => handleSelect(transaction.id)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <span className="text-gray-500 block text-xs mb-1">المبلغ الإجمالي</span>
                    <span className="font-bold text-gray-900">{formatCurrency(transaction.amount)}</span>
                  </div>
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <span className="text-blue-600 block text-xs mb-1">المتبقي</span>
                    <span className={`font-bold ${transaction.remaining_balance <= 0 ? 'text-green-600' : 'text-blue-700'}`}>
                      {formatCurrency(transaction.remaining_balance)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-xs text-gray-500 gap-2">
                  <span>تاريخ البدء:</span>
                  <span className="font-medium text-gray-700">{formatDate(new Date(transaction.start_date))}</span>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 border-t flex justify-between items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-10 text-sm" onClick={() => onViewTransaction(transaction)}>
                  <Eye className="h-4 w-4 ml-2" />
                  التفاصيل
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 h-10 text-sm bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onRecordPayment(transaction)}
                  disabled={isReadOnly}
                >
                  <DollarSign className="h-4 w-4 ml-2" />
                  دفع
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                      <MoreHorizontal className="h-5 w-5 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {transaction.status === 'overdue' && (
                      <DropdownMenuItem onClick={() => onSendReminder(transaction)}>
                        <MessageCircle className="h-4 w-4 ml-2 text-blue-600" />
                        <span>إرسال تذكير</span>
                      </DropdownMenuItem>
                    )}
                    {hasRole('admin') && (
                      <>
                        <DropdownMenuItem onClick={() => onEditTransaction(transaction)} disabled={isReadOnly}>
                          <Edit className="h-4 w-4 ml-2" />
                          <span>تعديل</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => onDeleteTransaction(transaction.id)}
                          disabled={isReadOnly}
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
          )) : (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed">
              <p className="text-gray-500">{searchTerm ? 'لا توجد معاملات مطابقة' : 'لا توجد معاملات'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionList;