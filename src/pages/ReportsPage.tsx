import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Transaction, ExportRow } from '@/lib/types';
import * as XLSX from 'xlsx';
import { format, setDate, addMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// --- Supabase API Function ---
const getReportableTransactions = async (): Promise<Transaction[]> => {
    const { data, error } = await supabase
        .from('transactions')
        .select(`*, customers (full_name, mobile_number)`)
        .gt('remaining_balance', 0)
        .eq('has_legal_case', false);

    if (error) throw new Error(error.message);

    return data.map((t: any) => ({
        ...t,
        customerName: t.customers?.full_name || 'Unknown',
        mobileNumber: t.customers?.mobile_number || '',
    }));
};
// --- End Supabase API Function ---

const ReportsPage = () => {
    const { toast } = useToast();
    const { data: transactions, isLoading } = useQuery<any[]>({
        queryKey: ['reportableTransactions'],
        queryFn: getReportableTransactions
    });

    const generateReport = () => {
        if (!transactions) {
            toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
            return;
        }

        const reportData = transactions.map((t: any) => {
            const now = new Date();
            const transactionDate = format(new Date(t.created_at), 'yyyy-MM-dd');
            const customerMobile = t.mobileNumber || '';
            const dueDate = format(setDate(now, 20), 'dd/MM/yyyy');
            const expiryDate = format(addMonths(now, 2), 'yyyy-MM-dd');

            const installmentNumber = (t.number_of_installments - Math.floor(t.remaining_balance / t.installment_amount)) + 1;
            
            // Add .250 to installment amount
            const amountWithFee = t.installment_amount + 0.250;
            
            // Format mobile number with 965 prefix
            const formattedMobile = customerMobile ? `965${customerMobile}` : '965';
            
            // Use sequence_number as reference or fallback to short ID
            const reference = t.sequence_number || t.id.substring(0, 8);
            
            // Create meaningful description using sequence_number
            const description = `${reference} - ${transactionDate} - ${amountWithFee}`;

            return {
                Description: description,
                Amount: amountWithFee,
                'First Name': t.customerName || 'غير محدد',
                'Last Name': '-',
                'Email Address': 'email@mail.com',
                'Mobile Number': formattedMobile,
                'Due Date': dueDate,
                Reference: reference,
                Notes: `Installment ${installmentNumber}`,
                Expiry: expiryDate
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');
        XLSX.writeFile(workbook, `Monthly_Payment_Report_${format(new Date(), 'yyyy_MM')}.xlsx`);

        toast({ title: "تم إنشاء التقرير", description: "تم تنزيل التقرير بنجاح." });
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-4">إنشاء التقارير</h1>
            <div className="p-4 border rounded-lg bg-card">
                <h2 className="text-xl font-semibold mb-2">تقرير الدفع الشهري</h2>
                <p className="text-muted-foreground mb-4">
                    قم بإنشاء وتنزيل تقرير الدفع الشهري بتنسيق Excel متوافق مع خدمة الدفع عبر الإنترنت.
                </p>
                <Button onClick={generateReport} disabled={isLoading || !transactions || transactions.length === 0}>
                    {isLoading ? 'جاري تحميل البيانات...' : 'إنشاء وتنزيل التقرير'}
                </Button>
                {transactions && transactions.length === 0 && !isLoading && (
                    <p className="text-sm text-muted-foreground mt-2">
                        لا توجد معاملات قابلة للتصدير حاليًا.
                    </p>
                )}
            </div>
        </div>
    );
};

export default ReportsPage;
