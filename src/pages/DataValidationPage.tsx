import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle, Calculator, RefreshCw, FileWarning, Hash, DollarSign, Percent, Calendar } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/utils-arabic';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface TransactionIssue {
  id: string;
  sequence_number: string;
  customer_name: string;
  cost_price: number | null;
  extra_price: number | null;
  amount: number;
  installment_amount: number;
  number_of_installments: number;
  issues: string[];
  calculated_extra_price: number | null;
  issueTypes: string[];
}

interface IssueSummary {
  missingCostPrice: number;
  missingExtraPrice: number;
  missingInstallmentAmount: number;
  missingInstallmentsCount: number;
  mismatchedExtraPrice: number;
  totalIssues: number;
  fixableIssues: number;
}

const DataValidationPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: issues, isLoading, refetch } = useQuery({
    queryKey: ['transactionValidation'],
    queryFn: async (): Promise<TransactionIssue[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          sequence_number,
          cost_price,
          extra_price,
          amount,
          installment_amount,
          number_of_installments,
          customers (full_name)
        `);

      if (error) throw new Error(error.message);

      const issuesFound: TransactionIssue[] = [];

      data?.forEach((t: any) => {
        const problems: string[] = [];
        const issueTypes: string[] = [];
        let calculatedExtra: number | null = null;

        if (t.cost_price === null || t.cost_price === 0) {
          problems.push('سعر السلعة مفقود');
          issueTypes.push('cost_price');
        }
        if (t.extra_price === null) {
          problems.push('السعر الإضافي مفقود');
          issueTypes.push('extra_price');
        }
        if (t.installment_amount === null || t.installment_amount === 0) {
          problems.push('قيمة القسط مفقودة');
          issueTypes.push('installment_amount');
        }
        if (t.number_of_installments === null || t.number_of_installments === 0) {
          problems.push('عدد الأقساط مفقود');
          issueTypes.push('installments_count');
        }

        if (t.number_of_installments && t.installment_amount && t.cost_price) {
          calculatedExtra = (t.number_of_installments * t.installment_amount) - t.cost_price;
          
          if (t.extra_price !== null && Math.abs(t.extra_price - calculatedExtra) > 0.01) {
            problems.push(`السعر الإضافي (${formatCurrency(t.extra_price)}) لا يتطابق مع القيمة المحسوبة (${formatCurrency(calculatedExtra)})`);
            issueTypes.push('mismatch');
          }
        }

        if (problems.length > 0) {
          issuesFound.push({
            id: t.id,
            sequence_number: t.sequence_number || 'غير محدد',
            customer_name: t.customers?.full_name || 'غير محدد',
            cost_price: t.cost_price,
            extra_price: t.extra_price,
            amount: t.amount,
            installment_amount: t.installment_amount,
            number_of_installments: t.number_of_installments,
            issues: problems,
            calculated_extra_price: calculatedExtra,
            issueTypes,
          });
        }
      });

      return issuesFound;
    },
  });

  const summary = useMemo((): IssueSummary => {
    if (!issues) return {
      missingCostPrice: 0,
      missingExtraPrice: 0,
      missingInstallmentAmount: 0,
      missingInstallmentsCount: 0,
      mismatchedExtraPrice: 0,
      totalIssues: 0,
      fixableIssues: 0,
    };

    return {
      missingCostPrice: issues.filter(i => i.issueTypes.includes('cost_price')).length,
      missingExtraPrice: issues.filter(i => i.issueTypes.includes('extra_price')).length,
      missingInstallmentAmount: issues.filter(i => i.issueTypes.includes('installment_amount')).length,
      missingInstallmentsCount: issues.filter(i => i.issueTypes.includes('installments_count')).length,
      mismatchedExtraPrice: issues.filter(i => i.issueTypes.includes('mismatch')).length,
      totalIssues: issues.length,
      fixableIssues: issues.filter(i => i.calculated_extra_price !== null).length,
    };
  }, [issues]);

  const fixMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const transactionsToFix = issues?.filter(i => ids.includes(i.id) && i.calculated_extra_price !== null) || [];
      
      for (const t of transactionsToFix) {
        const newAmount = (t.cost_price || 0) + (t.calculated_extra_price || 0);
        const { error } = await supabase
          .from('transactions')
          .update({ 
            extra_price: t.calculated_extra_price,
            amount: newAmount,
          })
          .eq('id', t.id);
        
        if (error) throw new Error(error.message);
      }
      
      return transactionsToFix.length;
    },
    onSuccess: (count) => {
      toast({ title: 'تم التحديث', description: `تم تحديث ${count} معاملة بنجاح` });
      queryClient.invalidateQueries({ queryKey: ['transactionValidation'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    },
  });

  const handleSelectAll = () => {
    if (selectedIds.length === (issues?.length || 0)) {
      setSelectedIds([]);
    } else {
      setSelectedIds(issues?.map(i => i.id) || []);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const fixableCount = issues?.filter(i => 
    selectedIds.includes(i.id) && i.calculated_extra_price !== null
  ).length || 0;

  const healthPercentage = issues ? Math.round(((issues.length === 0 ? 100 : 0) + (summary.fixableIssues / Math.max(summary.totalIssues, 1)) * 100) / 2) : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">فحص وتصحيح البيانات</h1>
          <p className="text-muted-foreground">فحص المعاملات للتأكد من صحة البيانات وتصحيح القيم المفقودة</p>
        </div>
        <Button onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`ml-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          إعادة الفحص
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المشاكل</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalIssues}</div>
            <p className="text-xs text-muted-foreground">
              {summary.fixableIssues} قابلة للإصلاح التلقائي
            </p>
            <Progress value={(summary.fixableIssues / Math.max(summary.totalIssues, 1)) * 100} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">حالة البيانات</CardTitle>
            {summary.totalIssues === 0 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalIssues === 0 ? 'ممتازة' : 'تحتاج مراجعة'}
            </div>
            <p className="text-xs text-muted-foreground">
              صحة البيانات: {100 - Math.min(summary.totalIssues, 100)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">معادلة الحساب</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium text-primary">
              السعر الإضافي = (عدد الأقساط × قيمة القسط) - سعر السلعة
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Issue Breakdown */}
      {summary.totalIssues > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ملخص الحقول الناقصة
            </CardTitle>
            <CardDescription>
              تفاصيل المشاكل المكتشفة في المعاملات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                  <DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.missingCostPrice}</p>
                  <p className="text-sm text-muted-foreground">سعر السلعة مفقود</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                  <Percent className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.missingExtraPrice}</p>
                  <p className="text-sm text-muted-foreground">السعر الإضافي مفقود</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.missingInstallmentAmount}</p>
                  <p className="text-sm text-muted-foreground">قيمة القسط مفقودة</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                  <Hash className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.missingInstallmentsCount}</p>
                  <p className="text-sm text-muted-foreground">عدد الأقساط مفقود</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.mismatchedExtraPrice}</p>
                  <p className="text-sm text-muted-foreground">قيم غير متطابقة</p>
                </div>
              </div>
            </div>

            {summary.fixableIssues > 0 && (
              <div className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {summary.fixableIssues} معاملة يمكن إصلاحها تلقائياً
                  </span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-400">
                  هذه المعاملات تحتوي على البيانات الكافية (سعر السلعة، عدد الأقساط، قيمة القسط) لحساب السعر الإضافي تلقائياً.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transaction Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {issues && issues.length > 0 ? (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                تفاصيل المعاملات ({issues.length})
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                جميع المعاملات صحيحة
              </>
            )}
          </CardTitle>
          <CardDescription>
            يتم التحقق من: سعر السلعة، السعر الإضافي، قيمة القسط، عدد الأقساط
          </CardDescription>
        </CardHeader>
        <CardContent>
          {issues && issues.length > 0 && (
            <>
              <div className="flex items-center gap-4 mb-4">
                <Button 
                  onClick={() => fixMutation.mutate(selectedIds)} 
                  disabled={fixableCount === 0 || fixMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Calculator className="ml-2 h-4 w-4" />
                  {fixMutation.isPending ? 'جاري التحديث...' : `تصحيح ${fixableCount} معاملة محددة`}
                </Button>
                {selectedIds.length > 0 && (
                  <Badge variant="secondary">
                    تم تحديد {selectedIds.length} معاملة
                  </Badge>
                )}
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedIds.length === issues.length && issues.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>رقم المعاملة</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>سعر السلعة</TableHead>
                      <TableHead>عدد الأقساط</TableHead>
                      <TableHead>قيمة القسط</TableHead>
                      <TableHead>السعر الإضافي الحالي</TableHead>
                      <TableHead>السعر الإضافي المحسوب</TableHead>
                      <TableHead>المشاكل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((issue) => (
                      <TableRow key={issue.id} className={selectedIds.includes(issue.id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(issue.id)}
                            onCheckedChange={() => handleSelect(issue.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{issue.sequence_number}</TableCell>
                        <TableCell>{issue.customer_name}</TableCell>
                        <TableCell>
                          {issue.cost_price !== null ? (
                            formatCurrency(issue.cost_price)
                          ) : (
                            <Badge variant="destructive">مفقود</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {issue.number_of_installments !== null && issue.number_of_installments > 0 ? (
                            issue.number_of_installments
                          ) : (
                            <Badge variant="destructive">مفقود</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {issue.installment_amount !== null && issue.installment_amount > 0 ? (
                            formatCurrency(issue.installment_amount)
                          ) : (
                            <Badge variant="destructive">مفقود</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {issue.extra_price !== null ? (
                            formatCurrency(issue.extra_price)
                          ) : (
                            <Badge variant="secondary">-</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {issue.calculated_extra_price !== null ? (
                            <span className="text-green-600 font-medium">
                              {formatCurrency(issue.calculated_extra_price)}
                            </span>
                          ) : (
                            <Badge variant="secondary">غير قابل للحساب</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {issue.issueTypes.map((type, idx) => (
                              <Badge 
                                key={idx} 
                                variant={type === 'mismatch' ? 'outline' : 'destructive'}
                                className="text-xs"
                              >
                                {type === 'cost_price' && 'سعر السلعة'}
                                {type === 'extra_price' && 'السعر الإضافي'}
                                {type === 'installment_amount' && 'قيمة القسط'}
                                {type === 'installments_count' && 'عدد الأقساط'}
                                {type === 'mismatch' && 'غير متطابق'}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="mr-3 text-muted-foreground">جاري فحص البيانات...</span>
            </div>
          )}

          {!isLoading && issues && issues.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">جميع البيانات صحيحة</h3>
              <p className="text-muted-foreground">لا توجد معاملات تحتاج إلى تصحيح</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataValidationPage;
