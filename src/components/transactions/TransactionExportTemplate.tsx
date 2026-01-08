import { Transaction, Payment } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils-arabic";

interface DetailedTransaction extends Transaction {
    payments: Payment[];
}

interface TransactionExportTemplateProps {
    transactions: DetailedTransaction[];
    type: 'single' | 'summary';
}

export const TransactionExportTemplate = ({ transactions, type }: TransactionExportTemplateProps) => {
    if (type === 'single' && transactions.length === 1) {
        const transaction = transactions[0];
        const totalPaid = transaction.payments.reduce((sum, p) => sum + p.amount, 0);

        return (
            <div className="p-8 bg-white w-[800px] text-right" dir="rtl">
                <div className="text-center border-b pb-4 mb-6">
                    <h1 className="text-2xl font-bold">تقرير تفصيلي للمعاملة</h1>
                    <p className="text-gray-500 mt-1">{formatDate(new Date())}</p>
                </div>

                {/* Transaction Info */}
                <div className="mb-8 bg-gray-50 p-4 rounded-lg border">
                    <h2 className="text-lg font-bold mb-4 text-primary">بيانات المعاملة</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-semibold ml-2">رقم المعاملة:</span>
                            <span>{transaction.sequence_number}</span>
                        </div>
                        <div>
                            <span className="font-semibold ml-2">العميل:</span>
                            <span>{transaction.customer?.full_name}</span>
                        </div>
                        <div>
                            <span className="font-semibold ml-2">تاريخ البدء:</span>
                            <span>{formatDate(new Date(transaction.start_date))}</span>
                        </div>
                        <div>
                            <span className="font-semibold ml-2">الحالة:</span>
                            <span>{transaction.status === 'active' ? 'نشطة' : transaction.status === 'completed' ? 'مكتملة' : transaction.status}</span>
                        </div>
                        {transaction.has_legal_case && (
                            <div className="col-span-2 text-red-600">
                                <span className="font-semibold ml-2">ملاحظات قانونية:</span>
                                <span>{transaction.legal_case_details || 'يوجد قضية قانونية'}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="mb-8">
                    <h2 className="text-lg font-bold mb-4 text-primary">الملخص المالي</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                            <div className="text-sm text-blue-600 mb-1">المبلغ الإجمالي</div>
                            <div className="text-xl font-bold text-blue-800">{formatCurrency(transaction.amount)}</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                            <div className="text-sm text-green-600 mb-1">إجمالي المدفوع</div>
                            <div className="text-xl font-bold text-green-800">{formatCurrency(totalPaid)}</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                            <div className="text-sm text-red-600 mb-1">المبلغ المتبقي</div>
                            <div className="text-xl font-bold text-red-800">{formatCurrency(transaction.remaining_balance)}</div>
                        </div>
                    </div>
                </div>

                {/* Payments History */}
                <div>
                    <h2 className="text-lg font-bold mb-4 text-primary">سجل الدفعات</h2>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-2">التاريخ</th>
                                <th className="border border-gray-300 p-2">المبلغ</th>
                                <th className="border border-gray-300 p-2">طريقة الدفع</th>
                                <th className="border border-gray-300 p-2">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transaction.payments.length > 0 ? (
                                transaction.payments
                                    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
                                    .map((p, i) => (
                                        <tr key={i}>
                                            <td className="border border-gray-300 p-2">{formatDate(new Date(p.payment_date))}</td>
                                            <td className="border border-gray-300 p-2">{formatCurrency(p.amount)}</td>
                                            <td className="border border-gray-300 p-2">{p.payment_method || '-'}</td>
                                            <td className="border border-gray-300 p-2">{p.notes || '-'}</td>
                                        </tr>
                                    ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="border border-gray-300 p-4 text-center text-gray-500">
                                        لا توجد دفعات مسجلة
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // Summary Report for Multiple Transactions
    return (
        <div className="p-8 bg-white w-[800px] text-right" dir="rtl">
            <div className="text-center border-b pb-4 mb-6">
                <h1 className="text-2xl font-bold">تقرير ملخص المعاملات</h1>
                <p className="text-gray-500 mt-1">{formatDate(new Date())}</p>
            </div>

            <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2">رقم المعاملة</th>
                        <th className="border border-gray-300 p-2">العميل</th>
                        <th className="border border-gray-300 p-2">تاريخ البدء</th>
                        <th className="border border-gray-300 p-2">المبلغ</th>
                        <th className="border border-gray-300 p-2">المدفوع</th>
                        <th className="border border-gray-300 p-2">المتبقي</th>
                        <th className="border border-gray-300 p-2">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((t, i) => {
                        const totalPaid = t.payments.reduce((sum, p) => sum + p.amount, 0);

                        return (
                            <tr key={i}>
                                <td className="border border-gray-300 p-2">{t.sequence_number}</td>
                                <td className="border border-gray-300 p-2">{t.customer?.full_name}</td>
                                <td className="border border-gray-300 p-2">{formatDate(new Date(t.start_date))}</td>
                                <td className="border border-gray-300 p-2">{formatCurrency(t.amount)}</td>
                                <td className="border border-gray-300 p-2">{formatCurrency(totalPaid)}</td>
                                <td className="border border-gray-300 p-2">{formatCurrency(t.remaining_balance)}</td>
                                <td className="border border-gray-300 p-2">
                                    {t.status === 'active' ? 'نشطة' : t.status === 'completed' ? 'مكتملة' : t.status}
                                    {t.has_legal_case && ' (قضية)'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="mt-4 text-xs text-gray-400">عدد المعاملات: {transactions.length}</div>
        </div>
    );
};
