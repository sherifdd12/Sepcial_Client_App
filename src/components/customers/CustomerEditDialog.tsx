import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Customer } from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleDatabaseError } from "@/lib/errorHandling";

interface CustomerEditDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CustomerEditDialog = ({ customer, open, onOpenChange }: CustomerEditDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<any>(customer || {});

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("customers")
        .update(data)
        .eq("id", customer?.id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تم تحديث بيانات العميل بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>تعديل بيانات العميل</DialogTitle>
          <DialogDescription>
            تحديث المعلومات الشخصية والاتصال للعميل.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="full_name">الاسم الكامل *</Label>
            <Input
              id="full_name"
              value={formData.full_name || ""}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="mobile_number">رقم الهاتف *</Label>
            <Input
              id="mobile_number"
              value={formData.mobile_number || ""}
              onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="alternate_phone">رقم هاتف بديل</Label>
            <Input
              id="alternate_phone"
              value={formData.alternate_phone || ""}
              onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="civil_id">الرقم المدني</Label>
            <Input
              id="civil_id"
              value={formData.civil_id || ""}
              onChange={(e) => setFormData({ ...formData, civil_id: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerEditDialog;
