import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import DateRangePicker from '@/components/shared/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Download,
  FileSpreadsheet,
  Calendar,
  TrendingUp,
  DollarSign,
  Filter,
  Search,
  Settings2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  LayoutGrid,
  List
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from 'date-fns';
import { formatCurrency } from '@/lib/utils-arabic';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const AdvancedReportsPage = () => {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [statuses, setStatuses] = useState<string[]>(['active', 'completed', 'overdue']);
  const [includeLegalCases, setIncludeLegalCases] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Tap Report Settings
  const [tapFee, setTapFee] = useState('0.250');
  const [tapDueDay, setTapDueDay] = useState('20');

  // Column Selection
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'sequence_number', 'customer_name', 'cost_price', 'extra_price',
    'amount', 'remaining_balance', 'installment_amount', 'status', 'start_date'
  ]);

  const columns = [
    { id: 'sequence_number', label: 'رقم المعاملة' },
    { id: 'customer_name', label: 'اسم العميل' },
    { id: 'mobile_number', label: 'رقم الهاتف' },
    { id: 'cost_price', label: 'سعر التكلفة' },
    { id: 'extra_price', label: 'الربح' },
    { id: 'amount', label: 'الإجمالي' },
    { id: 'remaining_balance', label: 'المتبقي' },
    { id: 'installment_amount', label: 'القسط' },
    { id: 'number_of_installments', label: 'عدد الأقساط' },
    { id: 'start_date', label: 'تاريخ البدء' },
    { id: 'status', label: 'الحالة' },
    { id: 'has_legal_case', label: 'قضية قانونية' },
  ];

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['advancedReport', date, statuses, includeLegalCases, customerSearch, minAmount, maxAmount],
    queryFn: async () => {
      if (!date?.from || !date?.to) return null;

      let query = supabase
        .from('transactions')
        .select(`
          id, sequence_number, cost_price, extra_price, amount, 
          remaining_balance, installment_amount, number_of_installments,
          start_date, status, has_legal_case,
          customers (full_name, mobile_number),
          payments (amount, payment_date)
        `)
        .gte('start_date', date.from.toISOString().split('T')[0])
        .lte('start_date', date.to.toISOString().split('T')[0]);

      if (statuses.length > 0) {
        query = query.in('status', statuses);
      }

      if (includeLegalCases) {
        query = query.eq('has_legal_case', true);
      }

      if (minAmount) {
        query = query.gte('amount', parseFloat(minAmount));
      }

      if (maxAmount) {
        query = query.lte('amount', parseFloat(maxAmount));
      }

      const { data: transactions, error } = await query;

      if (error) throw new Error(error.message);

      // Client-side filtering for customer name (Supabase RPC or complex joins would be better but this works for now)
      let filteredTransactions = transactions || [];
      if (customerSearch) {
        filteredTransactions = filteredTransactions.filter((t: any) =>
          t.customers?.full_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
          t.customers?.mobile_number?.includes(customerSearch)
        );
      }

      // Calculate totals
      let totalCostPrice = 0;
      let totalExtraPrice = 0;
      let totalAmount = 0;
      let totalRemainingBalance = 0;
      let totalPaid = 0;

      filteredTransactions.forEach((t: any) => {
        totalCostPrice += t.cost_price || 0;
        totalExtraPrice += t.extra_price || 0;
        totalAmount += t.amount || 0;
        totalRemainingBalance += t.remaining_balance || 0;
        t.payments?.forEach((p: any) => {
          totalPaid += p.amount || 0;
        });
      });

      return {
        transactions: filteredTransactions,
        summary: {
          totalCostPrice,
          totalExtraPrice,
          totalAmount,
          totalRemainingBalance,
          totalPaid,
          count: filteredTransactions.length,
        },
      };
    },
    enabled: false,
  });

  const handleStatusChange = (status: string) => {
    setStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnId) ? prev.filter(id => id !== columnId) : [...prev, columnId]
    );
  };

  const setQuickDate = (type: 'month' | 'year') => {
    const now = new Date();
    if (type === 'month') {
      setDate({ from: startOfMonth(now), to: endOfMonth(now) });
    } else {
      setDate({ from: startOfYear(now), to: endOfYear(now) });
    }
  };

  const generateReport = () => {
    refetch();
  };

  const exportToExcel = () => {
    if (!reportData?.transactions || reportData.transactions.length === 0) {
      toast({ title: 'لا توجد بيانات للتصدير', variant: 'destructive' });
      return;
    }

    const exportData = reportData.transactions.map((t: any) => {
      const row: any = {};
      if (selectedColumns.includes('sequence_number')) row['رقم المعاملة'] = t.sequence_number;
      if (selectedColumns.includes('customer_name')) row['اسم العميل'] = t.customers?.full_name || '';
      if (selectedColumns.includes('mobile_number')) row['رقم الهاتف'] = t.customers?.mobile_number || '';
      if (selectedColumns.includes('cost_price')) row['سعر التكلفة'] = t.cost_price;
      if (selectedColumns.includes('extra_price')) row['الربح'] = t.extra_price;
      if (selectedColumns.includes('amount')) row['الإجمالي'] = t.amount;
      if (selectedColumns.includes('remaining_balance')) row['المتبقي'] = t.remaining_balance;
      if (selectedColumns.includes('installment_amount')) row['القسط'] = t.installment_amount;
      if (selectedColumns.includes('number_of_installments')) row['عدد الأقساط'] = t.number_of_installments;
      if (selectedColumns.includes('start_date')) row['تاريخ البدء'] = t.start_date;
      if (selectedColumns.includes('status')) row['الحالة'] = t.status;
      if (selectedColumns.includes('has_legal_case')) row['قضية قانونية'] = t.has_legal_case ? 'نعم' : 'لا';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير المعاملات');
    XLSX.writeFile(wb, `تقرير_مخصص_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'تم التصدير بنجاح' });
  };

  const generateTapReport = async () => {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`*, customers (full_name, mobile_number)`)
      .gt('remaining_balance', 0)
      .eq('has_legal_case', false);

    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return;
    }

    const now = new Date();
    const fee = parseFloat(tapFee) || 0;
    const dueDay = parseInt(tapDueDay) || 20;

    const tapData = transactions?.map((t: any) => {
      const amountWithFee = (t.installment_amount || 0) + fee;
      const formattedMobile = t.customers?.mobile_number ? `965${t.customers.mobile_number}` : '965';
      const reference = t.sequence_number || t.id.substring(0, 8);
      const transactionDate = format(new Date(t.created_at), 'yyyy-MM-dd');

      return {
        Description: `${reference} - ${transactionDate} - ${amountWithFee.toFixed(3)}`,
        Amount: amountWithFee.toFixed(3),
        'First Name': t.customers?.full_name || 'غير محدد',
        'Last Name': '-',
        'Email Address': 'customer@mail.com',
        'Mobile Number': formattedMobile,
        'Due Date': format(new Date(now.getFullYear(), now.getMonth(), dueDay), 'dd/MM/yyyy'),
        Reference: reference,
        Notes: 'Installment Payment',
        Expiry: format(addMonths(now, 2), 'yyyy-MM-dd'),
      };
    }) || [];

    const ws = XLSX.utils.json_to_sheet(tapData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tap Payments');
    XLSX.writeFile(wb, `Tap_Report_${format(now, 'yyyy_MM')}.xlsx`);
    toast({ title: 'تم إنشاء تقرير Tap بنجاح' });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">التقارير المالية المتقدمة</h1>
          <p className="text-muted-foreground mt-1">أدوات تحليلية مرنة لتتبع أداء عملك المالي بدقة</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            <Clock className="h-3 w-3 ml-1" />
            تحديث تلقائي
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Tap Settings Card */}
        <Card className="md:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              إعدادات تقرير Tap
            </CardTitle>
            <CardDescription>تخصيص رسوم وتواريخ الدفع الإلكتروني</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tapFee">رسوم الخدمة (KWD)</Label>
              <Input
                id="tapFee"
                type="number"
                step="0.001"
                value={tapFee}
                onChange={(e) => setTapFee(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tapDueDay">يوم الاستحقاق في الشهر</Label>
              <Input
                id="tapDueDay"
                type="number"
                min="1"
                max="28"
                value={tapDueDay}
                onChange={(e) => setTapDueDay(e.target.value)}
                className="bg-background"
              />
            </div>
            <Button className="w-full mt-2" onClick={generateTapReport}>
              <Download className="ml-2 h-4 w-4" />
              إنشاء تقرير Tap
            </Button>
          </CardContent>
        </Card>

        {/* Custom Report Filters */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              فلاتر التقرير المخصص
            </CardTitle>
            <CardDescription>اختر المعايير بدقة للحصول على النتائج المطلوبة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>الفترة الزمنية</Label>
                <div className="flex flex-col gap-2">
                  <DateRangePicker date={date} onSelect={setDate} />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setQuickDate('month')}>
                      الشهر الحالي
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setQuickDate('year')}>
                      السنة الحالية
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>حالة المعاملات</Label>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Checkbox id="active" checked={statuses.includes('active')} onCheckedChange={() => handleStatusChange('active')} />
                    <Label htmlFor="active" className="text-sm cursor-pointer">نشطة</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="completed" checked={statuses.includes('completed')} onCheckedChange={() => handleStatusChange('completed')} />
                    <Label htmlFor="completed" className="text-sm cursor-pointer">مكتملة</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="overdue" checked={statuses.includes('overdue')} onCheckedChange={() => handleStatusChange('overdue')} />
                    <Label htmlFor="overdue" className="text-sm cursor-pointer">متأخرة</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="legal" checked={includeLegalCases} onCheckedChange={(c) => setIncludeLegalCases(!!c)} />
                    <Label htmlFor="legal" className="text-sm cursor-pointer">قضايا فقط</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-primary p-0 h-auto hover:bg-transparent"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                فلاتر متقدمة (البحث، المبالغ، الأعمدة)
              </Button>
            </div>

            {showAdvancedFilters && (
              <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2">
                <Separator />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>البحث عن عميل</Label>
                    <div className="relative">
                      <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="الاسم أو رقم الهاتف..."
                        className="pr-9"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>نطاق المبلغ الإجمالي</Label>
                    <div className="flex items-center gap-2">
                      <Input placeholder="من" type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                      <Input placeholder="إلى" type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    الأعمدة المطلوبة في التقرير
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 border rounded-md bg-muted/10">
                    {columns.map(col => (
                      <div key={col.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`col-${col.id}`}
                          checked={selectedColumns.includes(col.id)}
                          onCheckedChange={() => toggleColumn(col.id)}
                        />
                        <Label htmlFor={`col-${col.id}`} className="text-xs cursor-pointer truncate">{col.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full h-11 text-lg font-semibold shadow-lg shadow-primary/20"
              onClick={generateReport}
              disabled={!date?.from || !date?.to || isLoading}
            >
              {isLoading ? <RefreshCw className="ml-2 h-5 w-5 animate-spin" /> : <LayoutGrid className="ml-2 h-5 w-5" />}
              {isLoading ? 'جاري التحميل...' : 'توليد التقرير المخصص'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results Summary */}
      {reportData && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="border-r-4 border-r-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">عدد المعاملات</span>
                  <List className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{reportData.summary.count}</p>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-slate-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">سعر التكلفة</span>
                  <DollarSign className="h-4 w-4 text-slate-500" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(reportData.summary.totalCostPrice)}</p>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">إجمالي الأرباح</span>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(reportData.summary.totalExtraPrice)}</p>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-primary">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">إجمالي المبالغ</span>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold">{formatCurrency(reportData.summary.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-amber-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">المبالغ المتبقية</span>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(reportData.summary.totalRemainingBalance)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>معاينة البيانات المستخرجة</CardTitle>
                <CardDescription>تم العثور على {reportData.transactions.length} معاملة تطابق المعايير</CardDescription>
              </div>
              <Button variant="outline" onClick={exportToExcel} className="gap-2 border-green-600 text-green-700 hover:bg-green-50">
                <Download className="h-4 w-4" />
                تصدير إلى Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        {columns.filter(c => selectedColumns.includes(c.id)).map(col => (
                          <th key={col.id} className="p-3 font-semibold">{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.transactions.slice(0, 10).map((t: any, idx: number) => (
                        <tr key={t.id} className={`border-b hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                          {selectedColumns.includes('sequence_number') && <td className="p-3 font-medium">{t.sequence_number}</td>}
                          {selectedColumns.includes('customer_name') && <td className="p-3">{t.customers?.full_name}</td>}
                          {selectedColumns.includes('mobile_number') && <td className="p-3">{t.customers?.mobile_number}</td>}
                          {selectedColumns.includes('cost_price') && <td className="p-3">{formatCurrency(t.cost_price)}</td>}
                          {selectedColumns.includes('extra_price') && <td className="p-3 text-green-600">{formatCurrency(t.extra_price)}</td>}
                          {selectedColumns.includes('amount') && <td className="p-3 font-semibold">{formatCurrency(t.amount)}</td>}
                          {selectedColumns.includes('remaining_balance') && <td className="p-3 text-amber-600">{formatCurrency(t.remaining_balance)}</td>}
                          {selectedColumns.includes('installment_amount') && <td className="p-3">{formatCurrency(t.installment_amount)}</td>}
                          {selectedColumns.includes('number_of_installments') && <td className="p-3">{t.number_of_installments}</td>}
                          {selectedColumns.includes('start_date') && <td className="p-3">{t.start_date}</td>}
                          {selectedColumns.includes('status') && (
                            <td className="p-3">
                              <Badge variant={t.status === 'completed' ? 'success' : t.status === 'overdue' ? 'destructive' : 'default'}>
                                {t.status === 'active' ? 'نشطة' : t.status === 'completed' ? 'مكتملة' : 'متأخرة'}
                              </Badge>
                            </td>
                          )}
                          {selectedColumns.includes('has_legal_case') && <td className="p-3">{t.has_legal_case ? 'نعم' : 'لا'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {reportData.transactions.length > 10 && (
                  <div className="p-3 bg-muted/20 text-center text-xs text-muted-foreground border-t">
                    يتم عرض أول 10 نتائج فقط في المعاينة. قم بتصدير الملف لمشاهدة كافة البيانات ({reportData.transactions.length} معاملة).
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdvancedReportsPage;
