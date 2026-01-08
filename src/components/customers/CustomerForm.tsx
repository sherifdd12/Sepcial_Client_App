import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Customer } from "@/lib/types";
import { UserPlus, Save } from "lucide-react";

interface CustomerFormProps {
  customer?: Customer;
  onSave: (customer: Omit<Customer, 'id' | 'created_at'>) => void;
  onCancel: () => void;
  isLoading: boolean;
  suggestedSequenceNumber?: string;
}

const CustomerForm = ({ customer, onSave, onCancel, isLoading, suggestedSequenceNumber }: CustomerFormProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    sequence_number: customer?.sequence_number || suggestedSequenceNumber || '',
    full_name: customer?.full_name || '',
    mobile_number: customer?.mobile_number || '',
    alternate_phone: customer?.alternate_phone || '',
    civil_id: customer?.civil_id || '',
  });

  useEffect(() => {
    if (!customer && suggestedSequenceNumber && !formData.sequence_number) {
      setFormData(prev => ({ ...prev, sequence_number: suggestedSequenceNumber }));
    }
  }, [suggestedSequenceNumber, customer, formData.sequence_number]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name || !formData.mobile_number) {
      toast({
        title: "خطأ",
        description: "يرجى ملء الحقول المطلوبة (الاسم الكامل ورقم الهاتف)",
        variant: "destructive",
      });
      return;
    }

    onSave(formData);
  };

  return (
    <Card className="shadow-elevated">
      <CardHeader>
        <CardTitle className="flex items-center space-x-reverse space-x-2">
          <UserPlus className="h-5 w-5" />
          <span>{customer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sequenceNumber">م العميل</Label>
              <Input
                id="sequenceNumber"
                value={formData.sequence_number}
                onChange={(e) => setFormData({ ...formData, sequence_number: e.target.value })}
                placeholder="رقم تسلسلي للعميل (سيتم إنشاؤه تلقائياً)"
                className="text-right"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="fullName">الاسم الكامل *</Label>
              <Input
                id="fullName"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="أدخل الاسم الكامل"
                className="text-right"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mobileNumber">رقم الهاتف *</Label>
              <Input
                id="mobileNumber"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                placeholder="أدخل رقم الهاتف"
                className="text-right"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="alternatePhone">رقم الهاتف2</Label>
              <Input
                id="alternatePhone"
                value={formData.alternate_phone}
                onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
                placeholder="أدخل رقم هاتف بديل"
                className="text-right"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="civilId">الرقم المدني</Label>
            <Input
              id="civilId"
              value={formData.civil_id}
              onChange={(e) => setFormData({ ...formData, civil_id: e.target.value })}
              placeholder="أدخل الرقم المدني (اختياري)"
              className="text-right"
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-end space-x-reverse space-x-4 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              إلغاء
            </Button>
            <Button type="submit" className="flex items-center space-x-reverse space-x-2" disabled={isLoading}>
              <Save className="h-4 w-4" />
              <span>{isLoading ? (customer ? 'جاري التحديث...' : 'جاري الحفظ...') : (customer ? "تحديث" : "حفظ")}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CustomerForm;