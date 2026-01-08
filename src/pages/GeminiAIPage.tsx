import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Bot, Send, Sparkles, TrendingUp, Users, AlertTriangle, Settings, Loader2, ExternalLink } from 'lucide-react';
import { formatCurrency } from '@/lib/utils-arabic';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const GeminiAIPage = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setShowSettings(true);
    }
  }, []);

  // Fetch business context data
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_filtered_dashboard_stats', {
        p_year: 0,
        p_month: 0
      });
      return data?.[0];
    },
  });

  const { data: highRiskCustomers } = useQuery({
    queryKey: ['highRiskCustomers'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_high_risk_customers');
      return data;
    },
  });

  // Fetch all customers for client-side search context
  const { data: allCustomers } = useQuery({
    queryKey: ['allCustomersSimple'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, full_name, mobile_number');
      return data;
    },
  });

  const findRelevantCustomer = (text: string) => {
    if (!allCustomers) return null;
    const searchTerms = text.toLowerCase().split(' ');

    // Try to find a match for the full name or parts of it
    for (const customer of allCustomers) {
      if (text.includes(customer.full_name) || text.includes(customer.mobile_number)) {
        return customer;
      }
      // Check for partial matches (first name + last name) if the name is long enough
      const nameParts = customer.full_name.split(' ');
      if (nameParts.length >= 2) {
        if (text.includes(nameParts[0]) && text.includes(nameParts[nameParts.length - 1])) {
          return customer;
        }
      }
    }
    return null;
  };

  const fetchCustomerDetails = async (customerId: string) => {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('customer_id', customerId);

    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .eq('customer_id', customerId)
      .order('payment_date', { ascending: false })
      .limit(10); // Increased limit for better context

    return { transactions, payments };
  };

  const fetchMonthlyReport = async (month?: number, year?: number) => {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    // If month is not provided, fetch for the current year

    let query = supabase
      .from('payments')
      .select('amount, payment_date, customer_id, customers(full_name)')
      .gte('payment_date', `${targetYear}-01-01`)
      .lte('payment_date', `${targetYear}-12-31`);

    if (month) {
      const startDate = new Date(targetYear, month - 1, 1).toISOString();
      const endDate = new Date(targetYear, month, 0).toISOString();
      query = supabase
        .from('payments')
        .select('amount, payment_date, customer_id, customers(full_name)')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);
    }

    const { data } = await query;
    return data;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال مفتاح API صحيح', variant: 'destructive' });
      return;
    }
    localStorage.setItem('gemini_api_key', apiKey.trim());
    toast({ title: 'تم الحفظ', description: 'تم حفظ مفتاح API بنجاح' });
    setShowSettings(false);
  };

  const buildSystemContext = (additionalContext: string = '') => {
    const stats = dashboardStats as any || {};
    const risks = highRiskCustomers || [];

    let context = `أنت مساعد ذكي متخصص في تحليل البيانات المالية لنظام إدارة الأقساط.
    
معلومات الأعمال الحالية:
- إجمالي العملاء: ${stats?.total_customers || 0}
- المعاملات النشطة: ${stats?.total_active_transactions || 0}
- إجمالي الإيرادات: ${formatCurrency(stats?.total_revenue || 0)}
- إجمالي الأرباح: ${formatCurrency(stats?.total_profit || 0)}
- المبالغ المستحقة: ${formatCurrency(stats?.total_outstanding || 0)}
- المتأخرات: ${formatCurrency(stats?.total_overdue || 0)}
- عدد المعاملات المتأخرة: ${stats?.overdue_transactions || 0}

العملاء ذوو المخاطر العالية (${risks.length} عميل):
${risks.slice(0, 10).map((r: any) => `- ${r.full_name}: ${r.risk_reason}, مبلغ متأخر: ${formatCurrency(r.total_overdue_amount)}`).join('\n')}
`;

    if (additionalContext) {
      context += `\n\nمعلومات تفصيلية عن العميل المحدد:\n${additionalContext}`;
    }

    context += `\n\nقدم تحليلات مفيدة ونصائح عملية باللغة العربية. كن محددًا وعمليًا في اقتراحاتك.`;
    return context;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const currentKey = localStorage.getItem('gemini_api_key');
    if (!currentKey) {
      setShowSettings(true);
      toast({ title: 'مطلوب', description: 'يرجى إدخال مفتاح Gemini API', variant: 'destructive' });
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let additionalContext = '';
      const relevantCustomer = findRelevantCustomer(input);

      if (relevantCustomer) {
        const details = await fetchCustomerDetails(relevantCustomer.id);
        additionalContext = `
العميل: ${relevantCustomer.full_name} (${relevantCustomer.mobile_number})
المعاملات:
${details.transactions?.map((t: any) => `- معاملة #${t.sequence_number}: مبلغ ${formatCurrency(t.amount)}، متبقي ${formatCurrency(t.remaining_balance)}، الحالة: ${t.status}، السلعة: ${t.notes || 'غير محدد'}`).join('\n')}

آخر المدفوعات:
${details.payments?.map((p: any) => `- دفعة ${formatCurrency(p.amount)} بتاريخ ${new Date(p.payment_date).toLocaleDateString('ar-EG')}`).join('\n')}
        `;
      } else if (input.includes('شهر') || input.includes('يناير') || input.includes('فبراير') || input.includes('مارس') || input.includes('إبريل') || input.includes('مايو') || input.includes('يونيو') || input.includes('يوليو') || input.includes('أغسطس') || input.includes('سبتمبر') || input.includes('أكتوبر') || input.includes('نوفمبر') || input.includes('ديسمبر') || input.includes('اجمالي') || input.includes('مجموع')) {
        // Attempt to fetch a report if no specific customer is found but aggregation keywords exist
        // Simple heuristic: fetch data for the current year to allow client-side aggregation by AI
        const reportData = await fetchMonthlyReport();
        if (reportData && reportData.length > 0) {
          const total = reportData.reduce((sum, p) => sum + p.amount, 0);
          additionalContext = `
تقرير مالي عام (للسنة الحالية):
إجمالي المدفوعات المسجلة: ${formatCurrency(total)}
عدد المدفوعات: ${reportData.length}
عينة من المدفوعات الأخيرة:
${reportData.slice(0, 20).map((p: any) => `- ${formatCurrency(p.amount)} من ${p.customers?.full_name} بتاريخ ${new Date(p.payment_date).toLocaleDateString('ar-EG')}`).join('\n')}
... والمزيد.
              `;
        }
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: buildSystemContext(additionalContext) },
                  ...messages.map(m => ({ text: `${m.role === 'user' ? 'المستخدم' : 'المساعد'}: ${m.content}` })),
                  { text: `المستخدم: ${input}` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'لم أتمكن من فهم الطلب',
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء الاتصال بـ Gemini',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    'ما هي توصياتك لتحسين معدل التحصيل؟',
    'حلل لي العملاء ذوي المخاطر العالية',
    'ما هي أفضل استراتيجية للتعامل مع المتأخرات؟',
    'كيف يمكنني زيادة الأرباح؟',
    'اقترح خطة متابعة للعملاء المتأخرين',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            مساعد الذكاء الاصطناعي
          </h1>
          <p className="text-muted-foreground mt-2">
            تحليلات ونصائح ذكية مبنية على بيانات أعمالك
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="mr-2 h-4 w-4" />
          إعدادات API
        </Button>
      </div>

      {showSettings && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">إعدادات Gemini API</CardTitle>
            <CardDescription>
              للاستفادة من خدمات الذكاء الاصطناعي، يجب توفير مفتاح API خاص بك من Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">مفتاح API</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                />
                <Button onClick={handleSaveApiKey}>حفظ</Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>ليس لديك مفتاح؟</p>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 mt-1"
              >
                انقر هنا للحصول على مفتاح مجاني من Google AI Studio
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setInput('حلل الأداء المالي واقترح تحسينات')}>
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-success" />
            <div>
              <h4 className="font-medium">تحليل الأداء</h4>
              <p className="text-sm text-muted-foreground">تحليل شامل للوضع المالي</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setInput('حلل العملاء ذوي المخاطر العالية واقترح خطة متابعة')}>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-warning" />
            <div>
              <h4 className="font-medium">إدارة المخاطر</h4>
              <p className="text-sm text-muted-foreground">تحليل العملاء المتعثرين</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setInput('ما هي أفضل استراتيجية لتقليل المتأخرات؟')}>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <h4 className="font-medium">حلول المتأخرات</h4>
              <p className="text-sm text-muted-foreground">استراتيجيات التحصيل</p>
            </div>
          </CardContent>
        </Card>
      </div>


      <Card className="flex flex-col h-[500px]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            المحادثة
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-muted/30 rounded-lg">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>مرحبًا! أنا مساعدك الذكي. اسألني أي سؤال عن أعمالك.</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {suggestedQuestions.map((q, i) => (
                    <Button key={i} variant="outline" size="sm" onClick={() => setInput(q)}>
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} `}
                >
                  <div
                    className={`max - w - [80 %] p - 3 rounded - lg ${msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border'
                      } `}
                  >
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card border p-3 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="اكتب سؤالك هنا... (مثال: تفاصيل العميل فلان، آخر دفعة لفلان)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={2}
              className="resize-none"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div >
  );
};

export default GeminiAIPage;
