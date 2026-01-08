import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFinancialReport } from '@/integrations/supabase';
import { supabase } from '@/integrations/supabase/client';
import DateRangePicker from '@/components/shared/DateRangePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRange } from 'react-day-picker';
import { formatCurrency } from '@/lib/utils-arabic';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { FileSpreadsheet, Calendar, TrendingUp, DollarSign, Receipt, Users, CreditCard, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Customer {
  id: string;
  full_name: string;
  sequence_number: string | null;
  mobile_number: string;
}

const FinancialReportsPage = () => {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [statuses, setStatuses] = useState<string[]>(['active', 'completed', 'all']);
  const [isExportingDetailed, setIsExportingDetailed] = useState(false);
  const [isExportingPayments, setIsExportingPayments] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Fetch customers for filter
  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, full_name, sequence_number, mobile_number')
        .order('full_name');
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!customerSearch) return customers;
    const search = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.full_name.toLowerCase().includes(search) ||
      c.mobile_number.includes(search) ||
      (c.sequence_number && c.sequence_number.includes(search))
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  const { data: reportData, refetch, isLoading } = useQuery({
    queryKey: ['financialReport', date, statuses],
    queryFn: async () => {
      if (!date?.from || !date?.to) return null;
      const reportStatuses = statuses.includes('all') ? [] : statuses.filter(s => s !== 'all');
      return getFinancialReport(date.from.toISOString(), date.to.toISOString(), reportStatuses);
    },
    enabled: false,
  });

  // Fetch payments for the date range
  const { data: paymentsData } = useQuery({
    queryKey: ['paymentsReport', date],
    queryFn: async () => {
      if (!date?.from || !date?.to) return null;
      const { data } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .gte('payment_date', format(date.from, 'yyyy-MM-dd'))
        .lte('payment_date', format(date.to, 'yyyy-MM-dd'));
      return data;
    },
    enabled: !!date?.from && !!date?.to,
  });

  const totalPayments = paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const handleStatusChange = (status: string) => {
    if (status === 'all') {
      setStatuses(statuses.includes('all') ? [] : ['active', 'completed', 'all']);
    } else {
      let newStatuses = statuses.includes(status)
        ? statuses.filter(s => s !== status && s !== 'all')
        : [...statuses.filter(s => s !== 'all'), status];
      if (newStatuses.length === 2) newStatuses.push('all');
      setStatuses(newStatuses);
    }
  };

  const handleMonthlyReport = () => {
    const start = new Date();
    start.setDate(1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    setDate({ from: start, to: end });
  };

  const handleAnnualReport = () => {
    const start = new Date(new Date().getFullYear(), 0, 1);
    const end = new Date(new Date().getFullYear(), 11, 31);
    setDate({ from: start, to: end });
  };

  const handleExport = () => {
    if (!reportData?.[0]) return;
    const exportData = [{
      'سعر السلعة': reportData[0].total_item_price,
      'السعر الإضافي': reportData[0].total_additional_price,
      'إجمالي السعر': reportData[0].total_price,
      'قيمة الأقساط المتبقية': reportData[0].total_installment_value,
      'إجمالي المدفوعات': totalPayments,
      'من تاريخ': date?.from ? format(date.from, 'yyyy-MM-dd') : '',
      'إلى تاريخ': date?.to ? format(date.to, 'yyyy-MM-dd') : '',
    }];
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التقرير المالي');
    XLSX.writeFile(wb, `تقرير_مالي_${format(new Date(), 'yyyy_MM_dd')}.xlsx`);
  };

  const handleExportDetailed = async () => {
    if (!date?.from || !date?.to) {
      toast({ title: 'خطأ', description: 'يرجى تحديد الفترة الزمنية أولاً', variant: 'destructive' });
      return;
    }

    setIsExportingDetailed(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          sequence_number,
          start_date,
          cost_price,
          extra_price,
          amount,
          installment_amount,
          number_of_installments,
          remaining_balance,
          status,
          overdue_amount,
          overdue_installments,
          has_legal_case,
          notes,
          customer_id,
          customers (
            full_name,
            mobile_number,
            civil_id,
            sequence_number
          )
        `)
        .gte('start_date', format(date.from, 'yyyy-MM-dd'))
        .lte('start_date', format(date.to, 'yyyy-MM-dd'));

      // Apply status filter
      if (!statuses.includes('all')) {
        query = query.in('status', statuses);
      }

      // Apply customer filter
      if (selectedCustomerId) {
        query = query.eq('customer_id', selectedCustomerId);
      }

      const { data: transactions, error } = await query.order('start_date', { ascending: false });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        toast({ title: 'تنبيه', description: 'لا توجد معاملات في الفترة المحددة', variant: 'default' });
        setIsExportingDetailed(false);
        return;
      }

      const exportData = transactions.map((t: any) => ({
        'رقم المعاملة': t.sequence_number || '-',
        'رقم العميل': t.customers?.sequence_number || '-',
        'اسم العميل': t.customers?.full_name || '-',
        'رقم الهاتف': t.customers?.mobile_number || '-',
        'الرقم المدني': t.customers?.civil_id || '-',
        'تاريخ البدء': t.start_date,
        'سعر السلعة': t.cost_price || 0,
        'السعر الإضافي': t.extra_price || 0,
        'إجمالي المبلغ': t.amount || 0,
        'قيمة القسط': t.installment_amount || 0,
        'عدد الأقساط': t.number_of_installments || 0,
        'المبلغ المتبقي': t.remaining_balance || 0,
        'المبلغ المتأخر': t.overdue_amount || 0,
        'الأقساط المتأخرة': t.overdue_installments || 0,
        'الحالة': t.status === 'active' ? 'جارية' : t.status === 'completed' ? 'مكتملة' : t.status === 'overdue' ? 'متأخرة' : t.status,
        'قضية قانونية': t.has_legal_case ? 'نعم' : 'لا',
        'ملاحظات': t.notes || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المعاملات المفصلة');

      const summaryData = [{
        'إجمالي المعاملات': transactions.length,
        'إجمالي سعر السلع': transactions.reduce((sum: number, t: any) => sum + (t.cost_price || 0), 0),
        'إجمالي السعر الإضافي': transactions.reduce((sum: number, t: any) => sum + (t.extra_price || 0), 0),
        'إجمالي المبالغ': transactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
        'إجمالي المتبقي': transactions.reduce((sum: number, t: any) => sum + (t.remaining_balance || 0), 0),
        'إجمالي المتأخر': transactions.reduce((sum: number, t: any) => sum + (t.overdue_amount || 0), 0),
        'العميل': selectedCustomer?.full_name || 'جميع العملاء',
        'من تاريخ': format(date.from, 'yyyy-MM-dd'),
        'إلى تاريخ': format(date.to, 'yyyy-MM-dd'),
      }];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'ملخص');

      const fileName = selectedCustomer
        ? `تقرير_معاملات_${selectedCustomer.full_name}_${format(new Date(), 'yyyy_MM_dd')}.xlsx`
        : `تقرير_معاملات_مفصل_${format(new Date(), 'yyyy_MM_dd')}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast({ title: 'تم التصدير', description: `تم تصدير ${transactions.length} معاملة بنجاح` });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setIsExportingDetailed(false);
    }
  };

  const handleExportPaymentsDetailed = async () => {
    if (!date?.from || !date?.to) {
      toast({ title: 'خطأ', description: 'يرجى تحديد الفترة الزمنية أولاً', variant: 'destructive' });
      return;
    }

    setIsExportingPayments(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          balance_before,
          balance_after,
          notes,
          created_at,
          customer_id,
          transaction_id,
          customers (
            full_name,
            mobile_number,
            sequence_number
          ),
          transactions (
            sequence_number,
            amount,
            installment_amount
          )
        `)
        .gte('payment_date', format(date.from, 'yyyy-MM-dd'))
        .lte('payment_date', format(date.to, 'yyyy-MM-dd'));

      // Apply customer filter
      if (selectedCustomerId) {
        query = query.eq('customer_id', selectedCustomerId);
      }

      const { data: payments, error } = await query.order('payment_date', { ascending: false });

      if (error) throw error;

      if (!payments || payments.length === 0) {
        toast({ title: 'تنبيه', description: 'لا توجد مدفوعات في الفترة المحددة', variant: 'default' });
        setIsExportingPayments(false);
        return;
      }

      const exportData = payments.map((p: any) => ({
        'تاريخ الدفع': p.payment_date,
        'رقم العميل': p.customers?.sequence_number || '-',
        'اسم العميل': p.customers?.full_name || '-',
        'رقم الهاتف': p.customers?.mobile_number || '-',
        'رقم المعاملة': p.transactions?.sequence_number || '-',
        'مبلغ الدفعة': p.amount,
        'الرصيد قبل': p.balance_before || 0,
        'الرصيد بعد': p.balance_after || 0,
        'قيمة القسط': p.transactions?.installment_amount || 0,
        'إجمالي المعاملة': p.transactions?.amount || 0,
        'تاريخ التسجيل': p.created_at ? format(new Date(p.created_at), 'yyyy-MM-dd HH:mm') : '-',
        'ملاحظات': p.notes || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 18 }, { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المدفوعات المفصلة');

      // Summary sheet
      const totalAmount = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const summaryData = [{
        'إجمالي الدفعات': payments.length,
        'إجمالي المبالغ المدفوعة': totalAmount,
        'العميل': selectedCustomer?.full_name || 'جميع العملاء',
        'من تاريخ': format(date.from, 'yyyy-MM-dd'),
        'إلى تاريخ': format(date.to, 'yyyy-MM-dd'),
      }];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'ملخص');

      // Daily breakdown sheet
      const dailyTotals: Record<string, number> = {};
      payments.forEach((p: any) => {
        const date = p.payment_date;
        dailyTotals[date] = (dailyTotals[date] || 0) + Number(p.amount);
      });
      const dailyData = Object.entries(dailyTotals)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, total]) => ({
          'التاريخ': date,
          'إجمالي اليوم': total,
          'عدد الدفعات': payments.filter((p: any) => p.payment_date === date).length,
        }));
      const dailyWs = XLSX.utils.json_to_sheet(dailyData);
      XLSX.utils.book_append_sheet(wb, dailyWs, 'ملخص يومي');

      const fileName = selectedCustomer
        ? `تقرير_مدفوعات_${selectedCustomer.full_name}_${format(new Date(), 'yyyy_MM_dd')}.xlsx`
        : `تقرير_مدفوعات_مفصل_${format(new Date(), 'yyyy_MM_dd')}.xlsx`;

      XLSX.writeFile(wb, fileName);
      toast({ title: 'تم التصدير', description: `تم تصدير ${payments.length} دفعة بنجاح` });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setIsExportingPayments(false);
    }
  };

  const report = reportData?.[0];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            التقارير المالية
          </h1>
          <p className="text-muted-foreground">تحليل مالي شامل للمعاملات والمدفوعات</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            إعدادات التقرير
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Selection */}
          <div className="flex flex-wrap items-center gap-4">
            <DateRangePicker date={date} onSelect={setDate} />
            <Button variant="outline" onClick={handleMonthlyReport}>
              الشهر الحالي
            </Button>
            <Button variant="outline" onClick={handleAnnualReport}>
              السنة الحالية
            </Button>
          </div>

          {/* Customer Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              تصفية حسب العميل (اختياري)
            </Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم أو رقم الهاتف أو رقم العميل..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={selectedCustomerId || "all"} onValueChange={(val) => setSelectedCustomerId(val === "all" ? "" : val)}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="اختر عميل محدد أو اتركه فارغاً للكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع العملاء</SelectItem>
                  {filteredCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.sequence_number ? `${c.sequence_number} - ` : ''}{c.full_name} ({c.mobile_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomerId && (
                <Button variant="ghost" size="icon" onClick={() => setSelectedCustomerId('')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedCustomer && (
              <p className="text-sm text-primary">
                سيتم تصفية التقارير للعميل: {selectedCustomer.full_name}
              </p>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-6">
            <Label>حالة المعاملات:</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={statuses.includes('active')}
                onCheckedChange={() => handleStatusChange('active')}
              />
              <Label htmlFor="active">جارية</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="completed"
                checked={statuses.includes('completed')}
                onCheckedChange={() => handleStatusChange('completed')}
              />
              <Label htmlFor="completed">مكتملة</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="all"
                checked={statuses.includes('all')}
                onCheckedChange={() => handleStatusChange('all')}
              />
              <Label htmlFor="all">الكل</Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button onClick={() => refetch()} disabled={!date?.from || !date?.to || isLoading}>
              {isLoading ? 'جاري التحميل...' : 'إنشاء التقرير'}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!report}>
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              تصدير الملخص
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportDetailed}
              disabled={!date?.from || !date?.to || isExportingDetailed}
            >
              <Users className="h-4 w-4 ml-2" />
              {isExportingDetailed ? 'جاري التصدير...' : 'تقرير المعاملات المفصل'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportPaymentsDetailed}
              disabled={!date?.from || !date?.to || isExportingPayments}
            >
              <CreditCard className="h-4 w-4 ml-2" />
              {isExportingPayments ? 'جاري التصدير...' : 'تقرير المدفوعات المفصل'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                إجمالي سعر السلع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(report.total_item_price)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                السعر الإضافي (الربح)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(report.total_additional_price)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                إجمالي السعر
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(report.total_price)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                المبالغ المتبقية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(report.total_installment_value)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {paymentsData && date?.from && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              إجمالي المدفوعات في الفترة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(totalPayments)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              عدد الدفعات: {paymentsData.length} دفعة
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinancialReportsPage;
