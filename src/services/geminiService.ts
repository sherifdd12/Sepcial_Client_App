import { formatCurrency } from "@/lib/utils-arabic";

export interface AIAnalysisResult {
    summary: string;
    recommendations: string[];
    riskAssessment: string;
    strategicAdvice: string;
}

export const analyzeBusinessData = async (
    apiKey: string,
    stats: any,
    highRiskCustomers: any[],
    recentPayments: any[]
): Promise<AIAnalysisResult> => {
    if (!apiKey) throw new Error("API Key is required");

    const prompt = `
أنت خبير مالي ومحلل بيانات استراتيجي لنظام إدارة أقساط. 
بناءً على البيانات التالية، قدم تحليلاً عميقاً ونصائح حقيقية وعملية لصاحب العمل.

إحصائيات عامة:
- إجمالي العملاء: ${stats?.total_customers || 0}
- المعاملات النشطة: ${stats?.total_active_transactions || 0}
- إجمالي الإيرادات: ${formatCurrency(stats?.total_revenue || 0)}
- إجمالي الأرباح: ${formatCurrency(stats?.total_profit || 0)}
- المبالغ المستحقة: ${formatCurrency(stats?.total_outstanding || 0)}
- المتأخرات: ${formatCurrency(stats?.total_overdue || 0)}
- عدد المعاملات المتأخرة: ${stats?.overdue_transactions || 0}
- معدل التحصيل الحالي: ${stats?.total_revenue > 0 ? (((stats.total_revenue - stats.total_outstanding) / stats.total_revenue) * 100).toFixed(1) : 0}%

العملاء ذوو المخاطر العالية (${highRiskCustomers.length} عميل):
${highRiskCustomers.slice(0, 5).map((r: any) => `- ${r.full_name}: ${r.risk_reason}, مبلغ متأخر: ${formatCurrency(r.total_overdue_amount)}`).join('\n')}

عينة من آخر المدفوعات:
${recentPayments.slice(0, 5).map((p: any) => `- ${formatCurrency(p.amount)} بتاريخ ${new Date(p.payment_date).toLocaleDateString('ar-EG')}`).join('\n')}

المطلوب تقديم التحليل بتنسيق JSON كالتالي:
{
  "summary": "ملخص تنفيذي للوضع المالي الحالي (فقرة واحدة مركزة)",
  "recommendations": ["توصية 1", "توصية 2", "توصية 3"],
  "riskAssessment": "تقييم دقيق للمخاطر الحالية وكيفية تلافيها",
  "strategicAdvice": "نصيحة استراتيجية بعيدة المدى لزيادة الربحية وتحسين التدفق النقدي"
}

اجعل النصائح حقيقية وعملية جداً، وتجنب الكلام العام. استخدم لغة عربية مهنية وودودة.
`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        response_mime_type: "application/json",
                    }
                }),
            }
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return JSON.parse(resultText) as AIAnalysisResult;
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        throw error;
    }
};
