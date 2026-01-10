import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, BellDot, Check, Trash2, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatArabicDate } from "@/lib/utils-arabic";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const NotificationCenter = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    // Fetch notifications
    const { data: notifications, isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", session?.user?.id)
                .order("created_at", { ascending: false })
                .limit(20);
            if (error) throw error;
            return data;
        },
        enabled: !!session?.user?.id,
    });

    const unreadCount = notifications?.filter(n => !n.is_read).length || 0;

    // Real-time subscription
    useEffect(() => {
        if (!session?.user?.id) return;

        const channel = supabase
            .channel(`notifications-${session.user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${session.user.id}`,
                },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ["notifications"] });

                    // Play sound
                    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3");
                    audio.play().catch(() => { });

                    // Show toast
                    toast.info(payload.new.title, {
                        description: payload.new.message,
                        action: {
                            label: "عرض",
                            onClick: () => {
                                if (payload.new.type.startsWith("task")) navigate("/tasks");
                                markAsReadMutation.mutate(payload.new.id);
                            },
                        },
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id, queryClient, navigate]);

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", session?.user?.id)
                .eq("is_read", false);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    const handleNotificationClick = (notification: any) => {
        markAsReadMutation.mutate(notification.id);
        if (notification.type.startsWith("task")) {
            navigate("/tasks");
        }
        setIsOpen(false);
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    {unreadCount > 0 ? (
                        <>
                            <BellDot className="h-5 w-5 text-primary animate-pulse" />
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] h-4 flex items-center justify-center">
                                {unreadCount}
                            </span>
                        </>
                    ) : (
                        <Bell className="h-5 w-5 text-muted-foreground" />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <DropdownMenuLabel className="p-4 flex items-center justify-between">
                    <span className="font-bold">التنبيهات</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5"
                            onClick={() => markAllAsReadMutation.mutate()}
                        >
                            تحديد الكل كمقروء
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0" />
                <ScrollArea className="h-[400px]">
                    {isLoading ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>
                    ) : notifications?.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">لا توجد تنبيهات جديدة</div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications?.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/50 ${!notification.is_read ? "bg-primary/5" : ""
                                        }`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex gap-3">
                                        <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${notification.type.startsWith("task") ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                                            }`}>
                                            {notification.type.startsWith("task") ? <Clock className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <p className={`text-sm leading-none ${!notification.is_read ? "font-bold" : "font-medium"}`}>
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground pt-1">
                                                {formatArabicDate(new Date(notification.created_at))}
                                            </p>
                                        </div>
                                        {!notification.is_read && (
                                            <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <DropdownMenuSeparator className="m-0" />
                <div className="p-2">
                    <Button variant="ghost" className="w-full text-xs h-8" onClick={() => navigate("/tasks")}>
                        عرض كل المهام
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default NotificationCenter;
