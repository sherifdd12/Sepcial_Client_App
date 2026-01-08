import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp, Users, Brain, ArrowLeft } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface HighRiskCustomer {
  customer_id: string;
  full_name: string;
  mobile_number: string;
  risk_reason: string;
  total_outstanding: number;
  total_overdue_amount: number;
}

const fetchHighRiskCustomers = async (): Promise<HighRiskCustomer[]> => {
  const { data, error } = await supabase.rpc('get_high_risk_customers');
  if (error) throw new Error(error.message);
  return data || [];
};

const checkOverdueTransactions = async () => {
  const { data, error } = await supabase.rpc('check_overdue_transactions');
  if (error) throw new Error(error.message);
  return data;
};

const AIInsights = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const { data: highRiskCustomers = [], isLoading, error } = useQuery({
    queryKey: ['high-risk-customers'],
    queryFn: fetchHighRiskCustomers,
  });

  const checkOverdueMutation = useMutation({
    mutationFn: checkOverdueTransactions,
    onSuccess: (message) => {
      toast.success(message || 'تم فحص المتأخرات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['high-risk-customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (error: Error) => {
      toast.error(`فشل فحص المتأخرات: ${error.message}`);
    },
  });

  const handleCheckOverdue = () => {
    checkOverdueMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                العملاء ذوو المخاطر العالية
              </CardTitle>
              <CardDescription>
                عملاء يحتاجون إلى متابعة فورية بسبب التأخر في السداد
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/ai-analysis")}
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              التحليل الكامل
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {highRiskCustomers.length} عميل يحتاج إلى متابعة
              </span>
            </div>
            <Button 
              onClick={handleCheckOverdue}
              disabled={checkOverdueMutation.isPending}
              size="sm"
            >
              {checkOverdueMutation.isPending ? 'جاري الفحص...' : 'فحص المتأخرات'}
            </Button>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">خطأ في تحميل البيانات: {error.message}</div>
          ) : highRiskCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد حالات عالية المخاطر حالياً
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">سبب المخاطرة</TableHead>
                  <TableHead className="text-right">المبلغ المتبقي</TableHead>
                  <TableHead className="text-right">المتأخرات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRiskCustomers.map((customer) => (
                  <TableRow key={customer.customer_id}>
                    <TableCell>
                        <div className="font-medium">{customer.full_name}</div>
                        <div className="text-sm text-muted-foreground">{customer.mobile_number}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-amber-500 text-white hover:bg-amber-600">{customer.risk_reason}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(customer.total_outstanding)}</TableCell>
                    <TableCell className="text-destructive font-medium">
                        {formatCurrency(customer.total_overdue_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              توصيات ذكية
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/ai-analysis")}
              className="flex items-center gap-2"
            >
              المزيد
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {highRiskCustomers.length > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  • يوجد {highRiskCustomers.length} عملاء يحتاجون إلى متابعة فورية
                </p>
              </div>
            )}
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm">
                • ينصح بالتواصل مع العملاء المتأخرين لتجنب تفاقم المشكلة
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIInsights;
