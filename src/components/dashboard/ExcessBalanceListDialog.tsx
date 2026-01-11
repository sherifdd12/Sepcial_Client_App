import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils-arabic";
import { Loader2, User, Phone, Wallet } from "lucide-react";
import BalanceAdjustmentDialog from "@/components/customers/BalanceAdjustmentDialog";
import { Customer } from "@/lib/types";

interface ExcessBalanceListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ExcessBalanceListDialog = ({ open, onOpenChange }: ExcessBalanceListDialogProps) => {
    const queryClient = useQueryClient();
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
    const [selectedBalance, setSelectedBalance] = useState(0);

    const { data: customers, isLoading, refetch } = useQuery({
        queryKey: ["excess-balances"],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_customers_with_excess_balance');
            if (error) throw error;
            return data as { id: string; full_name: string; mobile_number: string; balance: number }[];
        },
        enabled: open,
    });

    const handleManage = (customer: any) => {
        const partialCustomer: Customer = {
            id: customer.id,
            full_name: customer.full_name,
            mobile_number: customer.mobile_number,
            sequence_number: "",
            created_at: "",
        };
        setSelectedCustomer(partialCustomer);
        setSelectedBalance(customer.balance);
        setIsAdjustmentOpen(true);
    };

    const handleAdjustmentSuccess = () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[600px]" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>العملاء ذوي الأرصدة الزائدة</DialogTitle>
                        <DialogDescription>قائمة بجميع العملاء الذين لديهم مبالغ زائدة (مستحقات) يمكن تسويتها.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-2 p-1">
                        {isLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : customers && customers.length > 0 ? (
                            customers.map((customer) => (
                                <div key={customer.id} className="flex items-center justify-between p-3 bg-card border rounded-lg shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><User className="h-5 w-5" /></div>
                                        <div>
                                            <div className="font-bold text-sm">{customer.full_name}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{customer.mobile_number}</div>
                                        </div>
                                    </div>
                                    <div className="text-left">
                                        <div className="font-bold text-green-600 dir-ltr">{formatCurrency(customer.balance)}</div>
                                        <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={() => handleManage(customer)}>
                                            <Wallet className="mr-1 h-3 w-3" /> إدارة
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">لا يوجد عملاء لديهم أرصدة زائدة حالياً.</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            {selectedCustomer && (
                <BalanceAdjustmentDialog
                    customer={selectedCustomer}
                    open={isAdjustmentOpen}
                    onOpenChange={setIsAdjustmentOpen}
                    currentBalance={selectedBalance}
                    onSuccess={handleAdjustmentSuccess}
                />
            )}
        </>
    );
};
export default ExcessBalanceListDialog;
