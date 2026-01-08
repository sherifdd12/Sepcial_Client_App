import { Customer, Transaction, Payment } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils-arabic";

interface DetailedCustomer extends Customer {
    transactions: (Transaction & { payments: Payment[] })[];
}

interface CustomerExportTemplateProps {
    customers: DetailedCustomer[];
    type: 'single' | 'summary';
}

export const CustomerExportTemplate = ({ customers, type }: CustomerExportTemplateProps) => {
    if (type === 'single' && customers.length === 1) {
        const customer = customers[0];
        const totalAmount = customer.transactions.reduce((sum, t) => sum + t.amount, 0);
        const totalPaid = customer.transactions.reduce((sum, t) => sum + (t.amount - t.remaining_balance), 0);
        const totalRemaining = customer.transactions.reduce((sum, t) => sum + t.remaining_balance, 0);

        return (
            <div className="p-8 bg-white w-[800px] text-right" dir="rtl">
                <div className="text-center border-b pb-4 mb-6">
                    <h1 className="text-2xl font-bold">تقرير تفصيلي للعميل</h1>
                    <p className="text-gray-500 mt-1">{formatDate(new Date())}</p>
                </div>

                {/* Customer Info */}
                <div className="mb-8 bg-gray-50 p-4 rounded-lg border">
                    <h2 className="text-lg font-bold mb-4 text-primary">بيانات العميل</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-semibold ml-2">الاسم:</span>
                            <span>{customer.full_name}</span>
                        </div>
                        <div>
                            <span className="font-semibold ml-2">رقم الهاتف:</span>
                            <span>{customer.mobile_number}</span>
                        </div>
                        <div>
                            <span className="font-semibold ml-2">الرقم المدني:</span>
                            <span>{customer.civil_id || '-'}</span>
                        </div>
                        <div>
                            <span className="font-semibold ml-2">رقم العميل:</span>
                            <span>{customer.sequence_number}</span>
                        </div>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold mb-4 text-primary">الملخص المالي</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                            <div className="text-sm text-blue-600 mb-1">إجمالي المديونية</div>
                            <div className="text-xl font-bold text-blue-800">{formatCurrency(totalAmount)}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                            <div className="text-sm text-green-600 mb-1">إجمالي المدفوع</div>
                            <div className="text-xl font-bold text-green-800">{formatCurrency(totalPaid)}</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                            <div className="text-sm text-red-600 mb-1">المبلغ المتبقي</div>
                            <div className="text-xl font-bold text-red-800">{formatCurrency(totalRemaining)}</div>
                        </div>
                    </div>
                </div>

                {/* Transactions */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold mb-4 text-primary">المعاملات</h2>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-2">رقم المعاملة</th>
                                <th className="border border-gray-300 p-2">تاريخ البدء</th>
                                <th className="border border-gray-300 p-2">المبلغ</th>
                                <th className="border border-gray-300 p-2">المتبقي</th>
                                <th className="border border-gray-300 p-2">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customer.transactions.map((t, i) => (
                                <tr key={i}>
                                    <td className="border border-gray-300 p-2">{t.sequence_number}</td>
                                    <td className="border border-gray-300 p-2">{formatDate(new Date(t.start_date))}</td>
                                    <td className="border border-gray-300 p-2">{formatCurrency(t.amount)}</td>
                                    <td className="border border-gray-300 p-2">{formatCurrency(t.remaining_balance)}</td>
                                    <td className="border border-gray-300 p-2">
                                        {t.status === 'active' ? 'نشطة' : t.status === 'completed' ? 'مكتملة' : t.status}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Recent Payments (Last 10) */}
                <div>
                    <h2 className="text-lg font-bold mb-4 text-primary">آخر الدفعات</h2>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-2">رقم المعاملة</th>
                                <th className="border border-gray-300 p-2">التاريخ</th>
                                <th className="border border-gray-300 p-2">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customer.transactions
                                .flatMap(t => t.payments.map(p => ({ ...p, transaction_sequence: t.sequence_number })))
                                .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                                .slice(0, 10)
                                .map((p, i) => (
                                    <tr key={i}>
                                        <td className="border border-gray-300 p-2">{p.transaction_sequence}</td>
                                        <td className="border border-gray-300 p-2">{formatDate(new Date(p.payment_date))}</td>
                                        <td className="border border-gray-300 p-2">{formatCurrency(p.amount)}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Summary Report for Multiple Customers
    return (
        <div className="p-8 bg-white w-[800px] text-right" dir="rtl">
            <div className="text-center border-b pb-4 mb-6">
                <h1 className="text-2xl font-bold">تقرير ملخص العملاء</h1>
                <p className="text-gray-500 mt-1">{formatDate(new Date())}</p>
            </div>

            <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2">م</th>
                        <th className="border border-gray-300 p-2">الاسم</th>
                        <th className="border border-gray-300 p-2">رقم الهاتف</th>
                        <th className="border border-gray-300 p-2">عدد المعاملات</th>
                        <th className="border border-gray-300 p-2">إجمالي المديونية</th>
                        <th className="border border-gray-300 p-2">المتبقي</th>
                    </tr>
                </thead>
                <tbody>
                    {customers.map((c, i) => {
                        const totalAmount = c.transactions.reduce((sum, t) => sum + t.amount, 0);
                        const totalRemaining = c.transactions.reduce((sum, t) => sum + t.remaining_balance, 0);

                        return (
                            <tr key={i}>
                                <td className="border border-gray-300 p-2">{c.sequence_number}</td>
                                <td className="border border-gray-300 p-2">{c.full_name}</td>
                                <td className="border border-gray-300 p-2">{c.mobile_number}</td>
                                <td className="border border-gray-300 p-2 text-center">{c.transactions.length}</td>
                                <td className="border border-gray-300 p-2">{formatCurrency(totalAmount)}</td>
                                <td className="border border-gray-300 p-2">{formatCurrency(totalRemaining)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="mt-4 text-xs text-gray-400">عدد العملاء: {customers.length}</div>
        </div>
    );
};
