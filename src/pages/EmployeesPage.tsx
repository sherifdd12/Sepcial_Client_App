import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, Edit, Save, Search, User, Phone, Briefcase, DollarSign, Calendar, FileText, Paperclip, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils-arabic";
import AttachmentManager from "@/components/shared/AttachmentManager";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EmployeesPage = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<any>(null);
    const [selectedEmployeeForAttachments, setSelectedEmployeeForAttachments] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const { data: employees, isLoading } = useQuery({
        queryKey: ["employees"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("employees")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const addMutation = useMutation({
        mutationFn: async (newEmployee: any) => {
            const { data, error } = await (supabase as any).from("employees").insert([newEmployee]).select();
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast({ title: "تم إضافة الموظف بنجاح", description: "يمكنك الآن إضافة المرفقات" });
            setIsDialogOpen(false);
            if (data && data.length > 0) {
                setSelectedEmployeeForAttachments(data[0]);
            }
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (employee: any) => {
            const { data, error } = await (supabase as any)
                .from("employees")
                .update(employee)
                .eq("id", employee.id)
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast({ title: "تم تحديث بيانات الموظف بنجاح" });
            setIsDialogOpen(false);
            setEditingEmployee(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any).from("employees").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["employees"] });
            toast({ title: "تم حذف الموظف" });
        },
    });

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = {
            full_name: formData.get("full_name"),
            mobile_number: formData.get("mobile_number"),
            position: formData.get("position"),
            salary: parseFloat(formData.get("salary") as string) || 0,
            join_date: formData.get("join_date"),
            notes: formData.get("notes"),
            civil_id: formData.get("civil_id"),
            passport_number: formData.get("passport_number"),
            residency_expiry: formData.get("residency_expiry") || null,
        };

        if (editingEmployee) {
            updateMutation.mutate({ ...data, id: editingEmployee.id });
        } else {
            addMutation.mutate(data);
        }
    };

    const filteredEmployees = employees?.filter((employee: any) =>
        employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.mobile_number?.includes(searchTerm) ||
        employee.civil_id?.includes(searchTerm) ||
        employee.position?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 p-6 bg-gray-50 rounded-xl min-h-screen" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">إدارة الموظفين</h2>
                    <p className="text-gray-500">إدارة بيانات الموظفين والمرفقات الخاصة بهم</p>
                </div>
                <Button onClick={() => { setEditingEmployee(null); setIsDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة موظف
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="بحث عن موظف (الاسم، الهاتف، الرقم المدني)..."
                            className="pr-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
                    ) : (
                        <div className="overflow-hidden">
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-right border-collapse">
                                    <thead>
                                        <tr className="border-b text-gray-500 text-sm bg-gray-50/50">
                                            <th className="p-3">الاسم</th>
                                            <th className="p-3">رقم الهاتف</th>
                                            <th className="p-3">المسمى الوظيفي</th>
                                            <th className="p-3">الرقم المدني</th>
                                            <th className="p-3">انتهاء الإقامة</th>
                                            <th className="p-3">الراتب</th>
                                            <th className="p-3">تاريخ التعيين</th>
                                            <th className="p-3">الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEmployees?.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center p-8 text-muted-foreground">لا يوجد موظفين</td>
                                            </tr>
                                        ) : (
                                            filteredEmployees?.map((employee: any) => (
                                                <tr key={employee.id} className="border-b hover:bg-gray-50 transition-colors">
                                                    <td className="p-3 font-medium flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                                                            {employee.full_name.substring(0, 2)}
                                                        </div>
                                                        {employee.full_name}
                                                    </td>
                                                    <td className="p-3 text-sm">{employee.mobile_number || "-"}</td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                                                            {employee.position || "غير محدد"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-sm">{employee.civil_id || "-"}</td>
                                                    <td className="p-3 text-sm">{employee.residency_expiry || "-"}</td>
                                                    <td className="p-3 font-medium">{formatCurrency(employee.salary)}</td>
                                                    <td className="p-3 text-sm">{employee.join_date || "-"}</td>
                                                    <td className="p-3">
                                                        <div className="flex gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => setSelectedEmployeeForAttachments(employee)} title="المرفقات">
                                                                <Paperclip className="h-4 w-4 text-blue-500" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => { setEditingEmployee(employee); setIsDialogOpen(true); }}>
                                                                <Edit className="h-4 w-4 text-gray-500" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(employee.id)}>
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-4">
                                {filteredEmployees?.length === 0 ? (
                                    <div className="text-center p-8 text-muted-foreground bg-white rounded-lg border border-dashed">لا يوجد موظفين</div>
                                ) : (
                                    filteredEmployees?.map((employee: any) => (
                                        <div key={employee.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                                        {employee.full_name.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900">{employee.full_name}</h4>
                                                        <div className="text-sm text-gray-500">{employee.position || "غير محدد"}</div>
                                                    </div>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => setSelectedEmployeeForAttachments(employee)}>
                                                            <Paperclip className="mr-2 h-4 w-4" />
                                                            المرفقات
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => { setEditingEmployee(employee); setIsDialogOpen(true); }}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            تعديل
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => deleteMutation.mutate(employee.id)} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            حذف
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-lg">
                                                <div>
                                                    <span className="text-gray-500 text-xs block mb-1">رقم الهاتف</span>
                                                    <span className="font-medium dir-ltr">{employee.mobile_number || "-"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 text-xs block mb-1">الراتب</span>
                                                    <span className="font-medium text-green-600 font-mono">{formatCurrency(employee.salary)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 text-xs block mb-1">الرقم المدني</span>
                                                    <span className="font-medium">{employee.civil_id || "-"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 text-xs block mb-1">انتهاء الإقامة</span>
                                                    <span className="font-medium">{employee.residency_expiry || "-"}</span>
                                                </div>
                                            </div>

                                            <Button
                                                variant="outline"
                                                className="w-full mt-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                                onClick={() => { setEditingEmployee(employee); setIsDialogOpen(true); }}
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                عرض التفاصيل
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-full max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{editingEmployee ? "تعديل بيانات موظف" : "إضافة موظف جديد"}</DialogTitle>
                        <DialogDescription>أدخل تفاصيل الموظف أدناه.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="full_name">الاسم الكامل</Label>
                                <div className="relative">
                                    <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input id="full_name" name="full_name" defaultValue={editingEmployee?.full_name} required className="pr-10" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mobile_number">رقم الهاتف</Label>
                                <div className="relative">
                                    <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input id="mobile_number" name="mobile_number" defaultValue={editingEmployee?.mobile_number} className="pr-10" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="position">المسمى الوظيفي</Label>
                                <div className="relative">
                                    <Briefcase className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input id="position" name="position" defaultValue={editingEmployee?.position} className="pr-10" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="civil_id">الرقم المدني</Label>
                                <Input id="civil_id" name="civil_id" defaultValue={editingEmployee?.civil_id} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="passport_number">رقم الجواز</Label>
                                <Input id="passport_number" name="passport_number" defaultValue={editingEmployee?.passport_number} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="residency_expiry">تاريخ انتهاء الإقامة</Label>
                                <Input id="residency_expiry" name="residency_expiry" type="date" defaultValue={editingEmployee?.residency_expiry} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="salary">الراتب</Label>
                                <div className="relative">
                                    <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input id="salary" name="salary" type="number" step="0.001" defaultValue={editingEmployee?.salary} className="pr-10" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="join_date">تاريخ التعيين</Label>
                                <div className="relative">
                                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input id="join_date" name="join_date" type="date" defaultValue={editingEmployee?.join_date || new Date().toISOString().split('T')[0]} className="pr-10" />
                                </div>
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="notes">ملاحظات</Label>
                                <div className="relative">
                                    <FileText className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input id="notes" name="notes" defaultValue={editingEmployee?.notes} className="pr-10" />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="flex gap-2 justify-start pt-4">
                            <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                                {(addMutation.isPending || updateMutation.isPending) ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                                {editingEmployee ? "حفظ التعديلات" : "حفظ ومتابعة للمرفقات"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Attachments Dialog */}
            <Dialog open={!!selectedEmployeeForAttachments} onOpenChange={(open) => !open && setSelectedEmployeeForAttachments(null)}>
                <DialogContent className="sm:max-w-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>ملفات الموظف: {selectedEmployeeForAttachments?.full_name}</DialogTitle>
                    </DialogHeader>
                    {selectedEmployeeForAttachments && (
                        <AttachmentManager
                            employeeId={selectedEmployeeForAttachments.id}
                            title={`ملفات: ${selectedEmployeeForAttachments.full_name}`}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default EmployeesPage;
