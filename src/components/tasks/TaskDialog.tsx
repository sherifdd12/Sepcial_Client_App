import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { Loader2, Paperclip, X, Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task?: any;
}

const TaskDialog = ({ open, onOpenChange, task }: TaskDialogProps) => {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [customerOpen, setCustomerOpen] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        assigned_to: "",
        due_at: "",
        customer_id: "",
        transaction_id: "",
    });

    useEffect(() => {
        if (task) {
            setFormData({
                title: task.title || "",
                description: task.description || "",
                assigned_to: task.assigned_to || "",
                due_at: task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : "",
                customer_id: task.customer_id || "",
                transaction_id: task.transaction_id || "",
            });
        } else {
            setFormData({
                title: "",
                description: "",
                assigned_to: "",
                due_at: "",
                customer_id: "",
                transaction_id: "",
            });
        }
        setFiles([]);
    }, [task, open]);

    // Fetch profiles for assignment (including email)
    const { data: profiles } = useQuery({
        queryKey: ["profiles-list-with-email"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .order("full_name");
            if (error) throw error;
            return data;
        },
    });

    // Fetch customers for linking
    const { data: customers } = useQuery({
        queryKey: ["customers-list-simple"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("customers")
                .select("id, full_name, mobile_number")
                .order("full_name")
                .limit(100);
            if (error) throw error;
            return data;
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.user?.id) return;

        setLoading(true);
        try {
            const taskData = {
                title: formData.title,
                description: formData.description,
                assigned_to: formData.assigned_to || null,
                due_at: formData.due_at || null,
                customer_id: formData.customer_id || null,
                transaction_id: formData.transaction_id || null,
                created_by: session.user.id,
            };

            let taskId = task?.id;

            if (task) {
                const { error } = await supabase
                    .from("employee_tasks")
                    .update(taskData)
                    .eq("id", task.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from("employee_tasks")
                    .insert([taskData])
                    .select()
                    .single();
                if (error) throw error;
                taskId = data.id;
            }

            // Handle file uploads
            if (files.length > 0 && taskId) {
                for (const file of files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;
                    const filePath = `tasks/${taskId}/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('task-attachments')
                        .upload(filePath, file);

                    if (uploadError) {
                        console.error("Upload error:", uploadError);
                        continue;
                    }

                    await supabase.from('task_attachments').insert({
                        task_id: taskId,
                        file_path: filePath,
                        file_name: file.name
                    });
                }
            }

            toast({ title: task ? "تم تحديث المهمة بنجاح" : "تم إنشاء المهمة بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["employee-tasks"] });
            onOpenChange(false);
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

    const selectedCustomer = customers?.find((c) => c.id === formData.customer_id);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{task ? "تعديل مهمة" : "إضافة مهمة جديدة"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">عنوان المهمة</Label>
                        <Input
                            id="title"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="مثال: متابعة قسط متأخر"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">الوصف</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="تفاصيل المهمة..."
                            rows={3}
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>تعيين إلى</Label>
                            <Select
                                value={formData.assigned_to}
                                onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر موظف" />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles?.map((profile) => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                            <div className="flex flex-col text-right">
                                                <span>{profile.full_name || "بدون اسم"}</span>
                                                <span className="text-[10px] text-muted-foreground">{profile.email}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="due_at">تاريخ الاستحقاق</Label>
                            <Input
                                id="due_at"
                                type="datetime-local"
                                value={formData.due_at}
                                onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>ربط بعميل (اختياري)</Label>
                        <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={customerOpen}
                                    className="w-full justify-between"
                                >
                                    {selectedCustomer
                                        ? `${selectedCustomer.full_name} (${selectedCustomer.mobile_number})`
                                        : "ابحث عن عميل..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                                <Command>
                                    <CommandInput placeholder="ابحث بالاسم أو رقم الهاتف..." />
                                    <CommandList>
                                        <CommandEmpty>لم يتم العثور على عملاء.</CommandEmpty>
                                        <CommandGroup>
                                            {customers?.map((customer) => (
                                                <CommandItem
                                                    key={customer.id}
                                                    value={`${customer.full_name} ${customer.mobile_number}`}
                                                    onSelect={() => {
                                                        setFormData({ ...formData, customer_id: customer.id });
                                                        setCustomerOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.customer_id === customer.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span>{customer.full_name}</span>
                                                        <span className="text-xs text-muted-foreground">{customer.mobile_number}</span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
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

                    <DialogFooter className="pt-4 gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                            إلغاء
                        </Button>
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {task ? "تحديث" : "إضافة"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default TaskDialog;
