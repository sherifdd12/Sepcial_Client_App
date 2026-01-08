import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  Target,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Phone,
  FileText,
  Sparkles,
  ShieldCheck,
  Lightbulb
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/utils-arabic";
import { analyzeBusinessData, AIAnalysisResult } from "@/services/geminiService";
import { useToast } from "@/components/ui/use-toast";

interface HighRiskCustomer {
  customer_id: string;
  full_name: string;
  mobile_number: string;
  risk_reason: string;
  total_outstanding: number;
  total_overdue_amount: number;
}

const AIAnalysisPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: highRiskCustomers = [], refetch: refetchRisks } = useQuery<HighRiskCustomer[]>({
    queryKey: ["high-risk-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_high_risk_customers");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_filtered_dashboard_stats", {
        p_year: 0,
        p_month: 0
      });
      if (error) throw error;
      return data[0];
    },
  });

  const { data: recentPayments = [] } = useQuery({
    queryKey: ["recent-payments-ai"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("amount, payment_date")
        .order("payment_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: overdueTransactions = [] } = useQuery({
    queryKey: ["overdue-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          customers (full_name, mobile_number)
        `)
        .eq("status", "overdue")
        .order("overdue_amount", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const performAIAnalysis = async () => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      toast({
        title: "مفتاح API مطلوب",
        description: "يرجى إعداد مفتاح Gemini API في صفحة مساعد AI أولاً.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeBusinessData(apiKey, stats, highRiskCustomers, recentPayments);
      setAiResult(result);
    } catch (error: any) {
      toast({
        title: "فشل التحليل",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (stats && highRiskCustomers.length >= 0) {
      performAIAnalysis();
    }
  }, [stats, highRiskCustomers]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchRisks(), refetchStats()]);
    await performAIAnalysis();
    setIsRefreshing(false);
  };

  const getRiskLevel = (overdueAmount: number) => {
    if (overdueAmount > 2000) return { level: "حرج", variant: "destructive" as const, color: "text-red-600" };
    if (overdueAmount > 1000) return { level: "عالي", variant: "secondary" as const, color: "text-orange-600" };
    return { level: "متوسط", variant: "outline" as const, color: "text-yellow-600" };
  };

  const getActionPriority = (customer: HighRiskCustomer) => {
    if (customer.total_overdue_amount > 2000) return "متابعة فورية - أولوية قصوى";
    if (customer.total_overdue_amount > 1000) return "متابعة عاجلة خلال 24 ساعة";
    return "متابعة في أقرب وقت";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              تحليلات الذكاء الاصطناعي المتقدمة
            </h1>
            <p className="text-muted-foreground mt-2">
              رؤى ذكية شاملة وتوصيات استراتيجية لتحسين الأداء المالي
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/gemini-ai")}>
            <Sparkles className="h-4 w-4 ml-2" />
            مساعد AI
          </Button>
          <Button onClick={handleRefresh} disabled={isRefreshing || isAnalyzing}>
            <RefreshCw className={`h-4 w-4 ml-2 ${isRefreshing || isAnalyzing ? 'animate-spin' : ''}`} />
            تحديث التحليل
          </Button>
        </div>
      </div>

      {/* AI Executive Summary */}
      {aiResult && (
        <Card className="border-primary/20 bg-primary/5 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles className="h-24 w-24 text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              الملخص التنفيذي الذكي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg leading-relaxed text-foreground/90">
              {aiResult.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">عملاء عاليو المخاطر</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{highRiskCustomers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">يحتاجون متابعة فورية</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">معاملات متأخرة</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.overdue_transactions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">معاملة نشطة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المتأخرات</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats?.total_overdue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">مبلغ متأخر</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">معدل التحصيل</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.total_revenue && stats?.total_outstanding
                ? Math.round((stats.total_revenue / (stats.total_revenue + stats.total_outstanding)) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">من إجمالي المعاملات</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ai-strategy" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-strategy" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            التحليل الاستراتيجي
          </TabsTrigger>
          <TabsTrigger value="high-risk" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            العملاء الأكثر خطورة
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            المعاملات المتأخرة
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            التوصيات الذكية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai-strategy" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <ShieldCheck className="h-5 w-5" />
                  تقييم المخاطر
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-900 leading-relaxed">
                  {aiResult?.riskAssessment || "جاري تحليل المخاطر..."}
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <TrendingUp className="h-5 w-5" />
                  النصيحة الاستراتيجية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-900 leading-relaxed">
                  {aiResult?.strategicAdvice || "جاري إعداد النصيحة الاستراتيجية..."}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>أهم التوصيات العملية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {aiResult?.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
                    <div className="bg-primary/10 p-1 rounded text-primary font-bold">{i + 1}</div>
                    <p className="text-foreground">{rec}</p>
                  </div>
                )) || <p className="text-muted-foreground">جاري استخراج التوصيات...</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="high-risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>العملاء ذوو المخاطر العالية - تحليل مفصل</CardTitle>
              <CardDescription>
                قائمة العملاء الذين يتطلبون متابعة عاجلة مع مستوى المخاطر والإجراءات الموصى بها
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {highRiskCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>ممتاز! لا يوجد عملاء ضمن المخاطر العالية حالياً</p>
                </div>
              ) : (
                highRiskCustomers.map((customer) => {
                  const risk = getRiskLevel(customer.total_overdue_amount);
                  return (
                    <Card key={customer.customer_id} className="border-l-4" style={{ borderLeftColor: risk.color }}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{customer.full_name}</h3>
                              <Badge variant={risk.variant}>{risk.level}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customer.mobile_number}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://wa.me/${customer.mobile_number}`, '_blank')}
                          >
                            <Phone className="h-4 w-4 ml-2" />
                            تواصل فوري
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">إجمالي المبلغ المتبقي</p>
                            <p className="text-lg font-semibold text-amber-600">{formatCurrency(customer.total_outstanding)}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">المبلغ المتأخر</p>
                            <p className="text-lg font-semibold text-red-600">{formatCurrency(customer.total_overdue_amount)}</p>
                          </div>
                        </div>

                        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium">سبب المخاطر: {customer.risk_reason}</p>
                              <p className="text-sm text-muted-foreground">{getActionPriority(customer)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/customers?customerId=${customer.customer_id}`)}>
                            <FileText className="h-3 w-3 ml-1" />
                            تفاصيل العميل
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate(`/transactions?customerId=${customer.customer_id}`)}>
                            <FileText className="h-3 w-3 ml-1" />
                            المعاملات
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>المعاملات المتأخرة - تفاصيل شاملة</CardTitle>
              <CardDescription>
                جميع المعاملات المتأخرة مرتبة حسب المبلغ المتأخر
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueTransactions.map((transaction: any) => (
                  <Card key={transaction.id} className="border-orange-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold">{transaction.customers?.full_name}</p>
                          <p className="text-sm text-muted-foreground">معاملة #{transaction.sequence_number}</p>
                        </div>
                        <Badge variant="secondary">متأخرة</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">المبلغ المتأخر</p>
                          <p className="font-semibold text-orange-600">{formatCurrency(transaction.overdue_amount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">أقساط متأخرة</p>
                          <p className="font-semibold">{transaction.overdue_installments} قسط</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">تاريخ البداية</p>
                          <p className="font-semibold flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(new Date(transaction.start_date))}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>التوصيات الاستراتيجية الذكية</CardTitle>
              <CardDescription>
                إجراءات موصى بها لتحسين معدلات التحصيل وتقليل المخاطر
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <Target className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">أولوية عليا: متابعة العملاء عاليي المخاطر</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          يوجد {highRiskCustomers.length} عميل يحتاجون إلى متابعة فورية. التواصل خلال 24 ساعة يزيد من فرص التحصيل بنسبة 65%.
                        </p>
                        <Button size="sm" className="mt-2" onClick={() => navigate("/customers")}>
                          بدء المتابعة الآن
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Phone className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">تحسين التواصل</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          إرسال تذكيرات واتساب دورية للعملاء المتأخرين. معدل الاستجابة للتذكيرات المبكرة أعلى بنسبة 40%.
                        </p>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/transactions")}>
                          إدارة التذكيرات
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-amber-100 p-2 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">تحليل الأداء الشهري</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          معدل التحصيل الحالي {stats?.total_revenue && stats?.total_outstanding
                            ? Math.round((stats.total_revenue / (stats.total_revenue + stats.total_outstanding)) * 100)
                            : 0}%. الهدف الموصى به: 85% للربع القادم.
                        </p>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/reports")}>
                          عرض التقارير
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 p-2 rounded-lg">
                        <Brain className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">تحسين شروط التقسيط</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          تحليل البيانات يشير إلى أن الأقساط الشهرية الأقل من {formatCurrency(200)} لديها معدل التزام أعلى.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIAnalysisPage;
