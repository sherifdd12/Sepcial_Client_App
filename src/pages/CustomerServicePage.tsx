import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Send,
    MessageSquare,
    Phone,
    CheckCheck,
    UserCircle,
    ArrowRight
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const CustomerServicePage = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [message, setMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch customers
    const { data: customers, isLoading: loadingCustomers } = useQuery({
        queryKey: ["customers-chat"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("customers")
                .select("id, full_name, mobile_number")
                .order("full_name");
            if (error) throw error;
            return data as any[];
        },
    });

    // Fetch chat logs for selected customer
    const { data: chatLogs, isLoading: loadingLogs } = useQuery({
        queryKey: ["customer-chat-logs", selectedCustomerId],
        queryFn: async () => {
            if (!selectedCustomerId) return [];
            const { data, error } = await (supabase as any)
                .from("customer_service_logs")
                .select(`
                    *,
                    employee:profiles(full_name)
                `)
                .eq("customer_id", selectedCustomerId)
                .order("created_at", { ascending: true });
            if (error) throw error;
            return data as any[];
        },
        enabled: !!selectedCustomerId,
    });

    // Real-time subscription
    useEffect(() => {
        if (!selectedCustomerId) return;

        const channel = supabase
            .channel(`chat-${selectedCustomerId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'customer_service_logs',
                    filter: `customer_id=eq.${selectedCustomerId}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["customer-chat-logs", selectedCustomerId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedCustomerId, queryClient]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatLogs]);

    const sendMutation = useMutation({
        mutationFn: async (type: 'employee' | 'customer') => {
            if (!message.trim() || !selectedCustomerId || !session?.user?.id) return;

            const { error } = await (supabase as any).from("customer_service_logs").insert({
                customer_id: selectedCustomerId,
                employee_id: session.user.id,
                message: message.trim(),
                sender_type: type,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setMessage("");
            queryClient.invalidateQueries({ queryKey: ["customer-chat-logs", selectedCustomerId] });
        },
        onError: (error: any) => {
            toast({
                title: "خطأ في إرسال الرسالة",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSendMessage = (type: 'employee' | 'customer') => {
        if (!message.trim() || !selectedCustomerId || !session?.user?.id) return;
        sendMutation.mutate(type);
    };

    const normalizeArabic = (text: string) => {
        return text
            .replace(/[أإآا]/g, "ا")
            .replace(/[ىي]/g, "ي")
            .replace(/[ةه]/g, "ه")
            .replace(/[ؤئ]/g, "ء")
            .toLowerCase();
    };

    const filteredCustomers = customers?.filter(c => {
        const normalizedQuery = normalizeArabic(searchQuery);
        const normalizedName = normalizeArabic(c.full_name);
        return normalizedName.includes(normalizedQuery) || c.mobile_number?.includes(searchQuery);
    });

    const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-background">
            {/* Sidebar - Customer List */}
            <div className={`w-full md:w-80 flex-shrink-0 border-l bg-card flex flex-col ${selectedCustomerId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        خدمة العملاء
                    </h2>
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث عن عميل..."
                            className="pr-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                        {loadingCustomers ? (
                            <div className="p-4 text-center text-muted-foreground">جاري التحميل...</div>
                        ) : filteredCustomers?.map(customer => (
                            <button
                                key={customer.id}
                                onClick={() => setSelectedCustomerId(customer.id)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedCustomerId === customer.id
                                    ? 'bg-primary/10 text-primary'
                                    : 'hover:bg-muted'
                                    }`}
                            >
                                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                        {customer.full_name.substring(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 text-right min-w-0">
                                    <p className="font-bold truncate">{customer.full_name}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                        {customer.mobile_number}
                                        <Phone className="h-3 w-3" />
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col bg-[#efeae2] dark:bg-muted/10 relative ${!selectedCustomerId ? 'hidden md:flex' : 'flex'}`}>
                {selectedCustomerId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-3 border-b bg-card flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden"
                                    onClick={() => setSelectedCustomerId(null)}
                                >
                                    <ArrowRight className="h-5 w-5" />
                                </Button>
                                <Avatar className="h-10 w-10 border border-border">
                                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                        {selectedCustomer?.full_name.substring(0, 2)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="text-right">
                                    <h3 className="font-bold text-sm sm:text-base">{selectedCustomer?.full_name}</h3>
                                    <p className="text-[10px] sm:text-xs text-green-600 flex items-center gap-1 justify-end">
                                        متصل الآن
                                        <span className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="text-muted-foreground">
                                    <Phone className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-muted-foreground">
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div
                            className="flex-1 overflow-y-auto p-4 scroll-smooth"
                            ref={scrollRef}
                        >
                            <div className="space-y-4 max-w-4xl mx-auto">
                                <div className="flex justify-center">
                                    <Badge variant="secondary" className="bg-white/80 dark:bg-card/80 backdrop-blur-sm text-[10px] py-1 px-3 shadow-sm border-none">
                                        سجل المحادثات مع العميل
                                    </Badge>
                                </div>

                                {loadingLogs ? (
                                    <div className="text-center py-10 text-muted-foreground">جاري تحميل السجلات...</div>
                                ) : chatLogs?.map((log) => {
                                    const isEmployee = log.sender_type === 'employee';
                                    return (
                                        <div
                                            key={log.id}
                                            className={`flex ${isEmployee ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                        >
                                            <div className={`max-w-[85%] sm:max-w-[70%] relative group`}>
                                                <div className={`
                                                    p-3 rounded-2xl shadow-sm text-sm relative
                                                    ${isEmployee
                                                        ? 'bg-white dark:bg-card rounded-tr-none text-foreground'
                                                        : 'bg-[#dcf8c6] dark:bg-primary/20 rounded-tl-none text-foreground'
                                                    }
                                                `}>
                                                    {isEmployee && (
                                                        <p className="text-[10px] font-bold text-primary mb-1 flex items-center gap-1">
                                                            <UserCircle className="h-3 w-3" />
                                                            {log.employee?.full_name || 'موظف'}
                                                        </p>
                                                    )}
                                                    <p className="leading-relaxed whitespace-pre-wrap">{log.message}</p>
                                                    <div className="flex items-center justify-end gap-1 mt-1">
                                                        <span className="text-[9px] opacity-60">
                                                            {new Date(log.created_at).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {!isEmployee && <CheckCheck className="h-3 w-3 text-blue-500" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-[#f0f2f5] dark:bg-card border-t z-10">
                            <div className="max-w-4xl mx-auto flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder="اكتب رسالة..."
                                        className="bg-white dark:bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary h-12 rounded-xl shadow-sm text-base"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage('employee');
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => handleSendMessage('employee')}
                                        className="flex-1 h-11 rounded-xl shadow-md bg-primary hover:bg-primary/90 flex items-center gap-2 font-bold"
                                        disabled={!message.trim() || sendMutation.isPending}
                                    >
                                        <Send className="h-4 w-4 rotate-180" />
                                        إرسال كموظف
                                    </Button>
                                    <Button
                                        onClick={() => handleSendMessage('customer')}
                                        className="flex-1 h-11 rounded-xl shadow-md bg-green-600 hover:bg-green-700 flex items-center gap-2 font-bold"
                                        disabled={!message.trim() || sendMutation.isPending}
                                    >
                                        <Send className="h-4 w-4 rotate-180" />
                                        إرسال كعميل
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center space-y-4">
                        <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                            <MessageSquare className="h-12 w-12 opacity-20" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-foreground">مرحباً بك في خدمة العملاء</h3>
                            <p className="max-w-xs mx-auto mt-2">
                                اختر عميلاً من القائمة الجانبية لعرض سجل المحادثات أو إضافة سجل جديد.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerServicePage;
