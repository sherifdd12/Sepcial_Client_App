import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Clock,
    User as UserIcon,
    Receipt,
    Paperclip,
    Calendar,
    FileText,
    Download,
    ExternalLink,
    CheckCircle,
    AlertCircle,
    Hourglass
} from "lucide-react";
import { formatArabicDate } from "@/lib/utils-arabic";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TaskDetailDialogProps {
    task: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const TaskDetailDialog = ({ task, open, onOpenChange }: TaskDetailDialogProps) => {
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    if (!task) return null;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none gap-1">
                        <CheckCircle className="h-3 w-3" />
                        مكتملة
                    </Badge>
                );
            case "snoozed":
                return (
                    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-none gap-1">
                        <Hourglass className="h-3 w-3" />
                        مؤجلة
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none gap-1">
                        <AlertCircle className="h-3 w-3" />
                        قيد الانتظار
                    </Badge>
                );
        }
    };

    const handleDownloadAttachment = async (attachment: any) => {
        setDownloadingId(attachment.id);
        try {
            const { data, error } = await supabase.storage
                .from('task-attachments')
                .download(attachment.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.file_name;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error: any) {
            toast({ title: "خطأ في تحميل الملف", description: error.message, variant: "destructive" });
        } finally {
            setDownloadingId(null);
        }
    };

    const handleViewAttachment = async (attachment: any) => {
        const { data } = supabase.storage
            .from('task-attachments')
            .getPublicUrl(attachment.file_path);

        window.open(data.publicUrl, '_blank');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
                <DialogHeader className="p-4 sm:p-6 pb-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        {getStatusBadge(task.status)}
                        {task.due_at && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatArabicDate(new Date(task.due_at))}
                            </span>
                        )}
                    </div>
                    <DialogTitle className="text-xl font-bold">{task.title}</DialogTitle>
                    <DialogDescription>تفاصيل المهمة الكاملة</DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 px-4 sm:px-6 pb-4 sm:pb-6">
                    <div className="space-y-6">
                        {/* Description */}
                        {task.description && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    الوصف
                                </h3>
                                <p className="text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">
                                    {task.description}
                                </p>
                            </div>
                        )}

                        <Separator />

                        {/* Task Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Assignee */}
                            <Card className="border-dashed">
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                            {task.assignee?.full_name?.substring(0, 2) || "؟"}
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">المُعيّن إليه</p>
                                            <p className="font-medium">{task.assignee?.full_name || "غير معين"}</p>
                                            {task.assignee?.email && (
                                                <p className="text-xs text-muted-foreground">{task.assignee.email}</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Creator */}
                            <Card className="border-dashed">
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold">
                                            {task.creator?.full_name?.substring(0, 2) || "؟"}
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">أنشأها</p>
                                            <p className="font-medium">{task.creator?.full_name || "غير معروف"}</p>
                                            {task.creator?.email && (
                                                <p className="text-xs text-muted-foreground">{task.creator.email}</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Related Customer/Transaction */}
                        {(task.customer || task.transaction) && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">مرتبط بـ</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {task.customer && (
                                            <Badge variant="outline" className="gap-1 py-1.5 px-3">
                                                <UserIcon className="h-3 w-3" />
                                                {task.customer.full_name}
                                            </Badge>
                                        )}
                                        {task.transaction && (
                                            <Badge variant="outline" className="gap-1 py-1.5 px-3">
                                                <Receipt className="h-3 w-3" />
                                                معاملة #{task.transaction.sequence_number}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Snooze Info */}
                        {task.status === "snoozed" && task.snoozed_until && (
                            <>
                                <Separator />
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-3">
                                    <Calendar className="h-5 w-5 text-yellow-600" />
                                    <div>
                                        <p className="text-sm font-medium text-yellow-800">مؤجلة حتى</p>
                                        <p className="text-sm text-yellow-700">{formatArabicDate(new Date(task.snoozed_until))}</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Attachments */}
                        {task.attachments?.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                                        <Paperclip className="h-4 w-4" />
                                        المرفقات ({task.attachments.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {task.attachments.map((att: any) => (
                                            <div
                                                key={att.id}
                                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                                        <Paperclip className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <span className="text-sm font-medium truncate">{att.file_name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => handleViewAttachment(att)}
                                                        title="عرض"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => handleDownloadAttachment(att)}
                                                        disabled={downloadingId === att.id}
                                                        title="تحميل"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Completion Notes */}
                        {task.status === "completed" && task.completion_notes && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        ملاحظات الإغلاق
                                    </h3>
                                    <p className="text-sm bg-green-50 border border-green-200 p-3 rounded-lg">
                                        {task.completion_notes}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Timestamps */}
                        <Separator />
                        <div className="text-xs text-muted-foreground space-y-1">
                            <p>تاريخ الإنشاء: {formatArabicDate(new Date(task.created_at))}</p>
                            {task.updated_at && task.updated_at !== task.created_at && (
                                <p>آخر تحديث: {formatArabicDate(new Date(task.updated_at))}</p>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default TaskDetailDialog;
