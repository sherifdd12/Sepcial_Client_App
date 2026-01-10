import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Search,
    Clock,
    User as UserIcon,
    MoreVertical,
    Receipt,
    Edit,
    Trash2,
    Paperclip,
    ExternalLink
} from "lucide-react";
import { formatArabicDate } from "@/lib/utils-arabic";
import { toast } from "@/hooks/use-toast";
import TaskDialog from "@/components/tasks/TaskDialog";
import TaskActionDialog from "@/components/tasks/TaskActionDialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TasksPage = () => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Dialog states
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [actionType, setActionType] = useState<"snooze" | "close">("close");
    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);

    // Fetch tasks
    const { data: tasks, isLoading } = useQuery({
        queryKey: ["employee-tasks"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("employee_tasks")
                .select(`
          *,
          creator:profiles!employee_tasks_created_by_fkey(full_name, email),
          assignee:profiles!employee_tasks_assigned_to_fkey(full_name, email),
          customer:customers(full_name),
          transaction:transactions(sequence_number),
          attachments:task_attachments(id, file_name, file_path)
        `)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    // Check for expired snoozes
    useEffect(() => {
        const checkSnoozes = async () => {
            if (!tasks || !session?.user?.id) return;

            const now = new Date().toISOString();
            const expiredSnoozes = tasks.filter(t =>
                t.status === "snoozed" &&
                t.snoozed_until &&
                t.snoozed_until < now
            );

            for (const task of expiredSnoozes) {
                // Update task status back to pending
                await supabase
                    .from("employee_tasks")
                    .update({ status: "pending", snoozed_until: null })
                    .eq("id", task.id);

                // Create notification
                await supabase.from("notifications").insert({
                    user_id: task.assigned_to || task.created_by,
                    title: "انتهى وقت التأجيل",
                    message: `انتهى وقت تأجيل المهمة: ${task.title}`,
                    type: "task_snooze_ended",
                    related_id: task.id
                });
            }

            if (expiredSnoozes.length > 0) {
                queryClient.invalidateQueries({ queryKey: ["employee-tasks"] });
                queryClient.invalidateQueries({ queryKey: ["notifications"] });
            }
        };

        checkSnoozes();
    }, [tasks, session?.user?.id, queryClient]);

    const deleteMutation = useMutation({
        mutationFn: async (taskId: string) => {
            const { error } = await supabase.from("employee_tasks").delete().eq("id", taskId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "تم حذف المهمة بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["employee-tasks"] });
        },
        onError: (error: any) => {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        }
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">مكتملة</Badge>;
            case "snoozed":
                return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-none">مؤجلة</Badge>;
            default:
                return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">قيد الانتظار</Badge>;
        }
    };

    const filteredTasks = tasks?.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            task.description?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "all" || task.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleEdit = (task: any) => {
        setSelectedTask(task);
        setIsTaskDialogOpen(true);
    };

    const handleAction = (task: any, type: "snooze" | "close") => {
        setSelectedTask(task);
        setActionType(type);
        setIsActionDialogOpen(true);
    };

    const handleCreate = () => {
        setSelectedTask(null);
        setIsTaskDialogOpen(true);
    };

    const handleDownloadAttachment = async (attachment: any) => {
        const { data, error } = await supabase.storage
            .from('task-attachments')
            .download(attachment.file_path);

        if (error) {
            toast({ title: "خطأ في تحميل الملف", description: error.message, variant: "destructive" });
            return;
        }

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.file_name;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">المهام</h1>
                    <p className="text-muted-foreground">إدارة وتتبع مهام الموظفين والتعاون</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleCreate} className="flex items-center gap-2 w-full sm:w-auto">
                        <Plus className="h-4 w-4" />
                        مهمة جديدة
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث عن مهمة..."
                                className="pr-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                            {["all", "pending", "snoozed", "completed"].map((status) => (
                                <Button
                                    key={status}
                                    variant={statusFilter === status ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setStatusFilter(status)}
                                    className="whitespace-nowrap"
                                >
                                    {status === "all" ? "الكل" :
                                        status === "pending" ? "قيد الانتظار" :
                                            status === "snoozed" ? "مؤجلة" : "مكتملة"}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">جاري تحميل المهام...</div>
                ) : filteredTasks?.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">لا توجد مهام مطابقة للبحث</div>
                ) : filteredTasks?.map((task) => (
                    <Card key={task.id} className="group hover:shadow-md transition-all duration-200 border-border/50 flex flex-col">
                        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                            <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {getStatusBadge(task.status)}
                                    {task.due_at && (
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatArabicDate(new Date(task.due_at))}
                                        </span>
                                    )}
                                </div>
                                <CardTitle className="text-base font-bold leading-tight pt-1">{task.title}</CardTitle>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(task)}>
                                        <Edit className="h-4 w-4 ml-2" />
                                        تعديل
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => {
                                            if (confirm("هل أنت متأكد من حذف هذه المهمة؟")) {
                                                deleteMutation.mutate(task.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 ml-2" />
                                        حذف
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4 flex-1 flex flex-col">
                            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>

                            <div className="flex flex-wrap gap-2">
                                {task.customer && (
                                    <Badge variant="outline" className="text-[10px] font-normal flex items-center gap-1">
                                        <UserIcon className="h-3 w-3" />
                                        {task.customer.full_name}
                                    </Badge>
                                )}
                                {task.transaction && (
                                    <Badge variant="outline" className="text-[10px] font-normal flex items-center gap-1">
                                        <Receipt className="h-3 w-3" />
                                        {task.transaction.sequence_number}
                                    </Badge>
                                )}
                                {task.attachments?.length > 0 && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Badge variant="secondary" className="text-[10px] font-normal flex items-center gap-1 cursor-pointer hover:bg-secondary/80">
                                                <Paperclip className="h-3 w-3" />
                                                {task.attachments.length} مرفقات
                                            </Badge>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            {task.attachments.map((att: any) => (
                                                <DropdownMenuItem key={att.id} onClick={() => handleDownloadAttachment(att)}>
                                                    <ExternalLink className="h-3 w-3 ml-2" />
                                                    {att.file_name}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>

                            <div className="mt-auto pt-4 border-t border-border/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                            {task.assignee?.full_name?.substring(0, 2) || "؟"}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-medium">{task.assignee?.full_name || "غير معين"}</span>
                                            {task.assignee?.email && <span className="text-[9px] text-muted-foreground">{task.assignee.email}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {task.status !== "completed" && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 px-2 text-xs"
                                                    onClick={() => handleAction(task, "snooze")}
                                                >
                                                    تأجيل
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => handleAction(task, "close")}
                                                >
                                                    إغلاق
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <TaskDialog
                open={isTaskDialogOpen}
                onOpenChange={setIsTaskDialogOpen}
                task={selectedTask}
            />

            <TaskActionDialog
                open={isActionDialogOpen}
                onOpenChange={setIsActionDialogOpen}
                task={selectedTask}
                action={actionType}
            />
        </div>
    );
};

export default TasksPage;
