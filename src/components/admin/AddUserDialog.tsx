import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, ExternalLink } from 'lucide-react';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdded: () => void;
}

const AddUserDialog = ({ open, onOpenChange, onUserAdded }: AddUserDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // Function to open Supabase Dashboard (User needs to replace with their actual project ID if they want a direct link, but generic link works too)
  const openSupabaseDashboard = () => {
    window.open('https://supabase.com/dashboard/project/_/auth/users', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            إضافة مستخدم جديد
          </DialogTitle>
          <DialogDescription>
            تعليمات إضافة المستخدمين في النظام
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>تنبيه هام</AlertTitle>
            <AlertDescription className="leading-relaxed mt-2">
              نظراً لاستخدام النسخة المجانية من Supabase، لا يمكن إنشاء مستخدمين جدد مباشرة من داخل التطبيق دون تسجيل الخروج أولاً.
            </AlertDescription>
          </Alert>

          <div className="space-y-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-900">لإضافة مستخدم جديد، لديك خياران:</p>

            <div className="bg-gray-50 p-3 rounded-lg border">
              <p className="font-medium text-gray-900 mb-1">1. عبر لوحة تحكم Supabase (موصى به للمدير)</p>
              <p className="mb-2">يمكنك دعوة المستخدمين عبر البريد الإلكتروني مباشرة من لوحة التحكم.</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={openSupabaseDashboard}
              >
                <ExternalLink className="h-4 w-4" />
                الذهاب إلى لوحة تحكم Supabase
              </Button>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border">
              <p className="font-medium text-gray-900 mb-1">2. التسجيل المباشر</p>
              <p>يمكن للموظف الجديد فتح التطبيق وتسجيل حساب جديد بنفسه عبر صفحة "إنشاء حساب" (Sign Up)، ثم يمكنك كمدير تعديل صلاحياته من هذه الصفحة.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            حسناً، فهمت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddUserDialog;
