import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Clock, CheckCircle2, Paperclip, X } from "lucide-react";

interface TaskActionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: any;
    action: "snooze" | "close";
}

const TaskActionDialog = ({ open, onOpenChange, task, action }: TaskActionDialogProps) => {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [notes, setNotes] = useState("");
    const [snoozeUntil, setSnoozeUntil] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleAction = async () => {
        if (!task) return;

        setLoading(true);
        try {
            const updates: any = {
                updated_at: new Date().toISOString(),
            };

            if (action === "snooze") {
                if (!snoozeUntil) {
                    toast({ title: "يرجى اختيار وقت التأجيل", variant: "destructive" });
                    setLoading(false);
                    return;
                }
                updates.status = "snoozed";
                updates.snoozed_until = snoozeUntil;
            } else {
                updates.status = "completed";
                updates.completion_notes = notes;
            }

            const { error } = await supabase
                .from("employee_tasks")
                .update(updates)
                .eq("id", task.id);

            if (error) throw error;

            // Handle file uploads for closing task
            if (action === "close" && files.length > 0) {
                for (const file of files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;
                    const filePath = `tasks/${task.id}/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('task-attachments')
                        .upload(filePath, file);

                    if (uploadError) {
                        console.error("Upload error:", uploadError);
                        continue;
                    }

                    await supabase.from('task_attachments').insert({
                        task_id: task.id,
                        file_path: filePath,
                        file_name: file.name
                    });
                }
            }

            toast({
                title: action === "snooze" ? "تم تأجيل المهمة" : "تم إغلاق المهمة بنجاح",
            });

            queryClient.invalidateQueries({ queryKey: ["employee-tasks"] });
            onOpenChange(false);
            setNotes("");
            setSnoozeUntil("");
            setFiles([]);
        } catch (error: any) {
            toast({
                title: "خطأ",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {action === "snooze" ? (
                            <>
                                <Clock className="h-5 w-5 text-yellow-600" />
                                تأجيل المهمة
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                إغلاق المهمة
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="text-sm font-medium text-muted-foreground">
                        المهمة: <span className="text-foreground">{task?.title}</span>
                    </div>

                    {action === "snooze" ? (
                        <div className="space-y-2">
                            <Label htmlFor="snooze_until">تأجيل حتى</Label>
                            <Input
                                id="snooze_until"
                                type="datetime-local"
                                value={snoozeUntil}
                                onChange={(e) => setSnoozeUntil(e.target.value)}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="notes">ملاحظات الإكمال</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="أضف ملاحظات حول ما تم إنجازه..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={4}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>المرفقات</Label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {files.map((file, i) => (
                                        <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-xs">
                                            <span className="truncate max-w-[100px]">{file.name}</span>
                                            <button type="button" onClick={() => removeFile(i)} className="text-destructive hover:text-destructive/80">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-dashed"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip className="h-4 w-4 ml-2" />
                                    إضافة ملفات
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    multiple
                                    onChange={handleFileChange}
                                />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                        إلغاء
                    </Button>
                    <Button
                        onClick={handleAction}
                        disabled={loading}
                        className={`flex-1 ${action === "close" ? "bg-green-600 hover:bg-green-700" : ""}`}
                    >
                        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        {action === "snooze" ? "تأكيد التأجيل" : "إغلاق المهمة"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TaskActionDialog;
