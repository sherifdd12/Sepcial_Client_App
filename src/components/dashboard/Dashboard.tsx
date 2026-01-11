import { handleDatabaseError } from "@/lib/errorHandling";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Receipt, DollarSign, AlertTriangle, TrendingUp, RefreshCw, Sparkles, Lightbulb, ShieldCheck, Building2, CreditCard, Calendar, AlertCircle, Gavel, Wallet, RefreshCcw } from "lucide-react";
import AIInsights from "./AIInsights";
import StatsCard from "./StatsCard";
import { DashboardStats } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { analyzeBusinessData, AIAnalysisResult } from "@/services/geminiService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils-arabic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ExcessBalanceListDialog from "./ExcessBalanceListDialog";

// --- Supabase API Functions ---
const getDashboardStats = async (year: number, month: number): Promise<DashboardStats> => {
  try {
    const { data, error } = await supabase.rpc('get_filtered_dashboard_stats', {
      p_year: year,
      p_month: month
    });

    if (error) {
      console.error("RPC Error:", error);
      throw new Error(error.message);
    }

    if (!data || (data as unknown[]).length === 0) {
      throw new Error("No data returned from server");
    }

    return (data as DashboardStats[])[0];
  } catch (err: unknown) {
    console.error("Dashboard Stats Fetch Error:", err);
    throw err;
  }
};

const checkOverdueTransactions = async (): Promise<{ message: string }> => {
  const { data, error } = await supabase.rpc('check_overdue_transactions');
  if (error) throw new Error(error.message);
  return { message: data as string };
};
// --- End Supabase API Functions ---

const Dashboard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Filter state
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<string>("0");
  const [selectedMonth, setSelectedMonth] = useState<string>("0");
  const [isExcessListOpen, setIsExcessListOpen] = useState(false);

  const { data: stats, isLoading, error, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats', selectedYear, selectedMonth],
    queryFn: () => getDashboardStats(parseInt(selectedYear), parseInt(selectedMonth)),
    retry: 1
  });

  const { data: highRiskCustomers = [] } = useQuery({
    queryKey: ['high-risk-customers-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_high_risk_customers');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentPayments = [] } = useQuery({
    queryKey: ["recent-payments-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .order("payment_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: appSettings } = useQuery({
    queryKey: ["app-settings-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) return {};
      const settingsMap: Record<string, string> = {};
      data.forEach((s) => {
        settingsMap[s.setting_key] = s.setting_value as string;
      });
      return settingsMap;
    },
  });

  useEffect(() => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (apiKey && stats && !aiResult && !isAnalyzing) {
      const performAnalysis = async () => {
        setIsAnalyzing(true);
        try {
          const result = await analyzeBusinessData(apiKey, stats, highRiskCustomers, recentPayments);
          setAiResult(result);
        } catch (error) {
          console.error("Dashboard AI Analysis Error:", error);
        } finally {
          setIsAnalyzing(false);
        }
      };
      performAnalysis();
    }
  }, [stats, highRiskCustomers, recentPayments, aiResult, isAnalyzing]);

  const overdueMutation = useMutation({
    mutationFn: checkOverdueTransactions,
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['high-risk-customers-dashboard'] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: handleDatabaseError(error), variant: "destructive" });
    }
  });

  const chartData = [
    {
      name: 'المالية',
      'إجمالي الإيرادات': stats?.total_revenue || 0,
      'إجمالي الأرباح': stats?.total_profit || 0,
      'المبالغ المستحقة': stats?.total_outstanding || 0,
      'إجمالي المصروفات': stats?.total_expenses || 0,
      'مستحقات العملاء': stats?.total_customer_receivables || 0
    },
  ];

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  const months = [
    { value: "0", label: "الكل" },
    { value: "1", label: "يناير" },
    { value: "2", label: "فبراير" },
    { value: "3", label: "مارس" },
    { value: "4", label: "أبريل" },
    { value: "5", label: "مايو" },
    { value: "6", label: "يونيو" },
    { value: "7", label: "يوليو" },
    { value: "8", label: "أغسطس" },
    { value: "9", label: "سبتمبر" },
    { value: "10", label: "أكتوبر" },
    { value: "11", label: "نوفمبر" },
    { value: "12", label: "ديسمبر" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-12 w-1/4" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="col-span-4 h-80" />
          <Skeleton className="col-span-3 h-80" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-center md:text-right">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">لوحة التحكم</h2>
          <p className="text-sm md:text-base text-muted-foreground">{appSettings?.app_description || "نظرة شاملة على أعمالك المالية"}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
          <div className="flex items-center gap-1 bg-card border rounded-lg px-2 py-1 shadow-sm overflow-x-auto max-w-full">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[90px] md:w-[100px] border-none shadow-none focus:ring-0 h-8 text-xs md:text-sm">
                <SelectValue placeholder="السنة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">كل السنوات</SelectItem>
                {years.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="h-4 w-[1px] bg-border mx-1 shrink-0" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[100px] md:w-[110px] border-none shadow-none focus:ring-0 h-8 text-xs md:text-sm">
                <SelectValue placeholder="الشهر" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => overdueMutation.mutate()} disabled={overdueMutation.isPending} variant="outline" size="sm" className="h-10 md:h-9">
            <RefreshCw className={`ml-2 h-4 w-4 ${overdueMutation.isPending ? 'animate-spin' : ''}`} />
            {overdueMutation.isPending ? 'جاري الفحص...' : 'فحص المتأخرات'}
          </Button>

          <Button onClick={() => setIsExcessListOpen(true)} variant="default" size="sm" className="h-10 md:h-9 bg-blue-600 hover:bg-blue-700">
            <Wallet className="ml-2 h-4 w-4" />
            فحص الأرصدة الزائدة
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>خطأ في تحميل البيانات</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{(error as Error).message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
              إعادة المحاولة
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!stats && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
          <p>لا توجد بيانات متاحة للفترة المختارة.</p>
        </div>
      )}

      {stats && (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="إجمالي العملاء" value={stats.total_customers} icon={Users} />
            <StatsCard title="المعاملات النشطة" value={stats.total_active_transactions} icon={Receipt} />
            <StatsCard title="إجمالي الإيرادات" value={stats.total_revenue} icon={TrendingUp} variant="success" isCurrency />
            <StatsCard title="إجمالي الأرباح" value={stats.total_profit} icon={TrendingUp} variant="success" isCurrency />
            <StatsCard title="المبالغ المستحقة" value={stats.total_outstanding} icon={DollarSign} variant="warning" isCurrency />
            <StatsCard title="المتأخرات" value={stats.total_overdue} icon={AlertTriangle} variant="danger" isCurrency />
            <StatsCard title="أتعاب قانونية" value={stats.total_legal_fees || 0} icon={Gavel} variant="default" isCurrency />
            <StatsCard title="إجمالي المصروفات" value={stats.total_expenses || 0} icon={Wallet} variant="danger" isCurrency />
            <StatsCard title="مستحقات العملاء" value={stats.total_customer_receivables || 0} icon={RefreshCw} variant="success" isCurrency />
            <StatsCard title="إجمالي المسترد" value={stats.total_refunds || 0} icon={RefreshCcw} variant="warning" isCurrency />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-green-50/50 border-green-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700">
                  <CreditCard className="h-4 w-4" />
                  إجمالي تحويلات تاب (Tap)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-900">
                  {formatCurrency(stats.tap_revenue || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50/50 border-blue-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
                  <Building2 className="h-4 w-4" />
                  إجمالي تحصيل المحكمة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-900">
                  {formatCurrency(stats.court_revenue || 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50/50 border-orange-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700">
                  <DollarSign className="h-4 w-4" />
                  إجمالي إيرادات أخرى
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-orange-900">
                  {formatCurrency(stats.other_revenue || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {!aiResult && !isAnalyzing && (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700">
                  <Sparkles className="h-4 w-4" />
                  رؤية الذكاء الاصطناعي (Gemini)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-amber-900">
                    قم بإعداد مفتاح Gemini API للحصول على تحليلات استراتيجية فورية وتوصيات ذكية لعملك.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={() => navigate("/gemini-ai")}
                  >
                    إعداد المفتاح الآن
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {aiResult && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="col-span-2 border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                    رؤية الذكاء الاصطناعي
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{aiResult.summary}</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700">
                    <Lightbulb className="h-4 w-4" />
                    نصيحة استراتيجية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-blue-900">{aiResult.strategicAdvice}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="col-span-4 bg-card shadow-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">نظرة عامة على الإيرادات</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => new Intl.NumberFormat('ar-KW', { style: 'currency', currency: 'KWD' }).format(value)} />
                  <Tooltip formatter={(value) => new Intl.NumberFormat('ar-KW', { style: 'currency', currency: 'KWD' }).format(value as number)} />
                  <Legend />
                  <Bar dataKey="إجمالي الإيرادات" fill="#16a34a" />
                  <Bar dataKey="إجمالي الأرباح" fill="#0ea5e9" />
                  <Bar dataKey="المبالغ المستحقة" fill="#f97316" />
                  <Bar dataKey="إجمالي المصروفات" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="col-span-3 bg-card shadow-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">إحصائيات سريعة</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">معدل التحصيل</span>
                  <span className="font-semibold text-success">
                    {stats.total_revenue > 0 ? `${(((stats.total_revenue - stats.total_outstanding) / stats.total_revenue) * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">المعاملات المتأخرة</span>
                  <span className="font-semibold text-danger">{stats.overdue_transactions}</span>
                </div>
                {aiResult && (
                  <div className="pt-4 border-t">
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-red-600" />
                      تقييم المخاطر
                    </h4>
                    <p className="text-[10px] text-muted-foreground leading-tight">{aiResult.riskAssessment}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">تحليلات الذكاء الاصطناعي</h3>
            <AIInsights />
          </div>
        </>
      )}
      <ExcessBalanceListDialog open={isExcessListOpen} onOpenChange={setIsExcessListOpen} />
    </div>
  );
};

export default Dashboard;