import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils-arabic";
import { TrendingUp, Users, AlertCircle, CheckCircle2, Calendar, ArrowUpRight, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

const BusinessInsightsPage = () => {
    const { data: insights, isLoading } = useQuery({
        queryKey: ["business-insights"],
        queryFn: async () => {
            // 1. Get all active transactions with customer info and payments
            const { data: transactions, error: tError } = await supabase
                .from('transactions')
                .select(`
                  *,
                  customers (id, full_name, mobile_number, sequence_number),
                  payments (id, amount, payment_date)
                `)
                .gt('remaining_balance', 0);

            if (tError) throw tError;

            // Sort by sequence_number as integer in descending order (newest first)
            const sortedTransactions = (transactions as any[]).sort((a, b) => {
                const numA = parseInt(a.sequence_number || '0');
                const numB = parseInt(b.sequence_number || '0');
                return numB - numA;
            });

            const now = new Date();
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);

            // Category 1: Regular Payers with strict criteria
            const regularPayersRaw = sortedTransactions.filter(t => {
                const payments = t.payments || [];
                if (payments.length === 0) return false;

                // Check progress >= 45%
                const progress = ((t.amount - t.remaining_balance) / t.amount) * 100;
                if (progress < 45) return false;

                // Check if transaction duration exceeded by more than 6 months
                if (t.start_date) {
                    const startDate = new Date(t.start_date);
                    if (!isNaN(startDate.getTime())) {
                        const expectedEndDate = new Date(startDate);
                        expectedEndDate.setMonth(startDate.getMonth() + (t.number_of_installments || 0));
                        const maxAllowedDate = new Date(expectedEndDate);
                        maxAllowedDate.setMonth(expectedEndDate.getMonth() + 6);
                        if (now > maxAllowedDate) return false;
                    }
                }

                // Check for 3-month gap in payments
                const sortedPayments = [...payments].sort((a, b) =>
                    new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
                );

                let hasThreeMonthGap = false;
                for (let i = 1; i < sortedPayments.length; i++) {
                    const prevDate = new Date(sortedPayments[i - 1].payment_date);
                    const currDate = new Date(sortedPayments[i].payment_date);
                    const diffMonths = (currDate.getFullYear() - prevDate.getFullYear()) * 12 +
                        (currDate.getMonth() - prevDate.getMonth());
                    if (diffMonths >= 3) {
                        hasThreeMonthGap = true;
                        break;
                    }
                }
                if (hasThreeMonthGap) return false;

                // Check last payment within 3 months
                const lastPayment = sortedPayments[sortedPayments.length - 1];
                const lastPaymentDate = new Date(lastPayment.payment_date);
                return lastPaymentDate >= threeMonthsAgo;
            });

            // Sort by progress descending (highest first)
            const regularPayers = regularPayersRaw.sort((a, b) => {
                const progressA = ((a.amount - a.remaining_balance) / a.amount) * 100;
                const progressB = ((b.amount - b.remaining_balance) / b.amount) * 100;
                return progressB - progressA;
            });

            // Category 2: Within Duration (Not exceeded duration and regular rate)
            const withinDuration = sortedTransactions.filter(t => {
                if (!t.start_date) return false;
                const startDate = new Date(t.start_date);
                if (isNaN(startDate.getTime())) return false;

                const endDate = new Date(startDate);
                endDate.setMonth(startDate.getMonth() + (t.number_of_installments || 0));

                if (now > endDate) return false;

                const monthsPassed = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
                const expectedPaid = (t.installment_amount || 0) * Math.max(0, monthsPassed);
                const actualPaid = (t.amount || 0) - (t.remaining_balance || 0);

                // Regular if actualPaid is within 2 installments of expected
                return actualPaid >= (expectedPaid - ((t.installment_amount || 0) * 2));
            });

            // 3. Estimate upcoming budget (sum of installment amounts for next month)
            const expectedMonthlyIncome = sortedTransactions.reduce((sum, t) => sum + (Number(t.installment_amount) || 0), 0);

            // 4. Calculate total expected profit from active transactions
            const totalExpectedProfit = sortedTransactions.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);

            // 5. Generate 12-month forecast data
            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            const forecastData = [];
            let cumulativeIncome = 0;

            for (let i = 0; i < 12; i++) {
                const futureDate = new Date();
                futureDate.setMonth(now.getMonth() + i);

                // Calculate expected income for this month (decreasing as transactions complete)
                const activeForMonth = sortedTransactions.filter(t => {
                    if (!t.start_date) return true;
                    const startDate = new Date(t.start_date);
                    const endDate = new Date(startDate);
                    endDate.setMonth(startDate.getMonth() + (t.number_of_installments || 0));
                    return futureDate <= endDate;
                });

                const monthlyIncome = activeForMonth.reduce((sum, t) => sum + (Number(t.installment_amount) || 0), 0);
                cumulativeIncome += monthlyIncome;

                forecastData.push({
                    month: monthNames[futureDate.getMonth()],
                    income: monthlyIncome,
                    cumulative: cumulativeIncome
                });
            }

            return {
                transactions: sortedTransactions,
                regularPayers,
                withinDuration,
                expectedMonthlyIncome,
                totalExpectedProfit,
                activeCount: sortedTransactions.length,
                regularCount: regularPayers.length,
                withinDurationCount: withinDuration.length,
                forecastData
            };
        }
    });

    if (isLoading) return <div className="p-8 text-center">جاري تحميل البيانات والتحليلات...</div>;

    const chartConfig = {
        income: {
            label: "الدخل الشهري",
            color: "hsl(217, 91%, 60%)"
        }
    };

    return (
        <div className="space-y-6 p-1 md:p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">تحليلات العمل والميزانية المتوقعة</h1>
                <p className="text-muted-foreground">نظرة شاملة على التدفقات النقدية المتوقعة وفرص التوسع مع العملاء الحاليين.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            الميزانية الشهرية المتوقعة
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">{formatCurrency(insights?.expectedMonthlyIncome || 0)}</div>
                        <p className="text-xs text-blue-700 mt-1">إجمالي الأقساط المستحقة شهرياً</p>
                    </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            فرص تجديد المعاملات
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900">{insights?.regularCount} عملاء</div>
                        <p className="text-xs text-green-700 mt-1">عملاء منتظمون بالسداد (نسبة إنجاز 45%+)</p>
                    </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            إجمالي المعاملات النشطة
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-900">{insights?.activeCount} معاملة</div>
                        <p className="text-xs text-purple-700 mt-1">قيد التحصيل حالياً</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowUpRight className="h-5 w-5 text-green-600" />
                        عملاء منتظمون (فرص تجديد)
                    </CardTitle>
                    <CardDescription>عملاء بنسبة إنجاز 45%+، بدون فجوة 3 أشهر في السداد، ولم يتجاوزوا مدة المعاملة بأكثر من 6 أشهر.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-right">العميل</TableHead>
                                    <TableHead className="text-right">رقم المعاملة</TableHead>
                                    <TableHead className="text-right">المبلغ المتبقي</TableHead>
                                    <TableHead className="text-right">نسبة الإنجاز</TableHead>
                                    <TableHead className="text-right">الحالة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {insights?.regularPayers.length ? insights.regularPayers.map((t: any) => {
                                    const progress = ((t.amount - t.remaining_balance) / t.amount) * 100;
                                    return (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{t.customers?.full_name}</span>
                                                    <span className="text-xs text-muted-foreground">{t.customers?.mobile_number}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="outline">{t.sequence_number}</Badge></TableCell>
                                            <TableCell className="text-green-600 font-bold">{formatCurrency(t.remaining_balance)}</TableCell>
                                            <TableCell className="w-[200px]">
                                                <div className="flex items-center gap-2">
                                                    <Progress value={progress} className="h-2 flex-1" />
                                                    <span className="text-xs font-medium">{progress.toFixed(0)}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                                    سداد منتظم
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            لا يوجد عملاء منتظمون حالياً.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        عملاء ضمن المدة الزمنية
                    </CardTitle>
                    <CardDescription>هؤلاء العملاء لم يتجاوزوا مدة المعاملة المتفق عليها ومعدل سدادهم جيد.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-right">العميل</TableHead>
                                    <TableHead className="text-right">رقم المعاملة</TableHead>
                                    <TableHead className="text-right">تاريخ البدء</TableHead>
                                    <TableHead className="text-right">المبلغ المتبقي</TableHead>
                                    <TableHead className="text-right">الحالة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {insights?.withinDuration.length ? insights.withinDuration.map((t: any) => {
                                    return (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{t.customers?.full_name}</span>
                                                    <span className="text-xs text-muted-foreground">{t.customers?.mobile_number}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="outline">{t.sequence_number}</Badge></TableCell>
                                            <TableCell>{t.start_date ? formatDate(new Date(t.start_date)) : '---'}</TableCell>
                                            <TableCell className="text-blue-600 font-bold">{formatCurrency(t.remaining_balance)}</TableCell>
                                            <TableCell>
                                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                                                    ضمن المدة
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            لا يوجد عملاء ضمن المدة حالياً.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-blue-600" />
                            توقعات التدفق النقدي (12 شهر)
                        </CardTitle>
                        <CardDescription>
                            إجمالي الدخل المتوقع: {formatCurrency(insights?.forecastData?.reduce((sum: number, d: any) => sum + d.income, 0) || 0)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                            <AreaChart data={insights?.forecastData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    formatter={(value: any) => formatCurrency(value)}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="income"
                                    stroke="hsl(217, 91%, 60%)"
                                    fillOpacity={1}
                                    fill="url(#colorIncome)"
                                    name="الدخل الشهري"
                                />
                            </AreaChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                            تنبيهات استراتيجية
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-50 border border-orange-100">
                            <div className="mt-1"><AlertCircle className="h-4 w-4 text-orange-600" /></div>
                            <div>
                                <p className="text-sm font-medium text-orange-900">تنبيه السيولة</p>
                                <p className="text-xs text-orange-700">هناك {insights?.withinDurationCount} معاملات نشطة ضمن مدتها الزمنية، مما يضمن تدفقاً شهرياً مستقراً بمقدار {formatCurrency(insights?.expectedMonthlyIncome || 0)}.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                            <div className="mt-1"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
                            <div>
                                <p className="text-sm font-medium text-green-900">فرصة نمو</p>
                                <p className="text-xs text-green-700">العملاء الذين أتموا 80% من أقساطهم هم الأكثر ترشيحاً لتمويل جديد. تواصل معهم الآن.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default BusinessInsightsPage;
