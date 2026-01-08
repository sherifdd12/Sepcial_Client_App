import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const PaymentSuccessPage = () => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');

    const tapId = searchParams.get('tap_id');
    const chargeStatus = searchParams.get('status');
    const [settings, setSettings] = useState<any>({});
    const [paymentDetails, setPaymentDetails] = useState<{ amount: number; customerName: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('app_settings').select('*');
            if (data) {
                const settingsMap: any = {};
                data.forEach((s: any) => {
                    settingsMap[s.setting_key] = s.setting_value;
                });
                setSettings(settingsMap);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const fetchPaymentDetails = async () => {
            if (!tapId) return;
            const { data, error } = await (supabase as any)
                .from('invoices')
                .select('amount, metadata')
                .eq('tap_id', tapId)
                .maybeSingle();

            if (data) {
                const metadata = data.metadata as any;
                const firstName = metadata?.customer?.first_name || "";
                const lastName = metadata?.customer?.last_name || "";
                setPaymentDetails({
                    amount: data.amount,
                    customerName: `${firstName} ${lastName}`.trim() || "عميل"
                });
            }
        };

        if (tapId) {
            fetchPaymentDetails();
        }
    }, [tapId]);

    useEffect(() => {
        // Determine payment status from URL params
        if (chargeStatus === 'CAPTURED' || chargeStatus === 'APPROVED') {
            setStatus('success');
        } else if (chargeStatus === 'FAILED' || chargeStatus === 'DECLINED' || chargeStatus === 'CANCELLED') {
            setStatus('failed');
        } else {
            // If no status, assume success (Tap redirected here)
            setTimeout(() => {
                setStatus('success');
            }, 1500);
        }
    }, [chargeStatus]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4" dir="rtl">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4">
                        {settings['app_logo'] ? (
                            <img
                                src={settings['app_logo']}
                                alt="شعار التطبيق"
                                className="w-20 h-20 mx-auto rounded-xl shadow-md object-contain bg-white p-1"
                            />
                        ) : (
                            <div className="w-16 h-16 mx-auto rounded-xl bg-blue-100 flex items-center justify-center shadow-sm">
                                <CheckCircle2 className="h-8 w-8 text-blue-600" />
                            </div>
                        )}
                    </div>
                    <CardTitle className="text-xl font-bold text-gray-800">
                        {settings['app_name'] || "نظام إدارة الأقساط"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-6 py-8">
                    {status === 'loading' && (
                        <>
                            <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto" />
                            <div>
                                <h2 className="text-xl font-semibold text-gray-700">جاري معالجة الدفع...</h2>
                                <p className="text-gray-500 mt-2">يرجى الانتظار</p>
                            </div>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="h-24 w-24 rounded-full bg-green-100 animate-ping opacity-75"></div>
                                </div>
                                <CheckCircle2 className="h-24 w-24 text-green-500 mx-auto relative" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-green-600">تم الدفع بنجاح! ✓</h2>
                                {paymentDetails && (
                                    <div className="mt-4 space-y-1">
                                        <p className="text-lg font-semibold text-gray-700">
                                            المبلغ: <span className="text-green-600">{paymentDetails.amount} د.ك</span>
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            العميل: {paymentDetails.customerName}
                                        </p>
                                    </div>
                                )}
                                <p className="text-gray-600 mt-3">
                                    شكرًا لك. تم استلام دفعتك وسيتم تحديث حسابك قريبًا.
                                </p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <p className="text-sm text-green-700">
                                    يمكنك إغلاق هذه الصفحة بأمان
                                </p>
                            </div>
                            {tapId && (
                                <p className="text-xs text-gray-400">
                                    رقم العملية: {tapId}
                                </p>
                            )}
                        </>
                    )}

                    {status === 'failed' && (
                        <>
                            <XCircle className="h-24 w-24 text-red-500 mx-auto" />
                            <div>
                                <h2 className="text-2xl font-bold text-red-600">فشل الدفع</h2>
                                <p className="text-gray-600 mt-3">
                                    عذرًا، لم نتمكن من إتمام عملية الدفع. يرجى المحاولة مرة أخرى.
                                </p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                <p className="text-sm text-red-700">
                                    إذا استمرت المشكلة، يرجى التواصل مع الدعم
                                </p>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PaymentSuccessPage;
