import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { handleDatabaseError } from '@/lib/errorHandling';
import { Eye, EyeOff, Mail, Lock, Loader2, UserPlus } from 'lucide-react';

const registerUser = async ({ email, password }: { email: string; password: string }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("User already registered")) {
      throw new Error("هذا المستخدم مسجل بالفعل.");
    }
    throw error;
  }

  if (data.user && data.user.identities && data.user.identities.length === 0) {
    throw new Error("هذا المستخدم مسجل بالفعل. الرجاء تسجيل الدخول.");
  }

  return data;
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: () => {
      toast({
        title: 'تم تسجيل حسابك بنجاح!',
        description: 'تم إرسال رابط تأكيد إلى بريدك الإلكتروني. الرجاء تأكيد بريدك ثم انتظار موافقة المدير.',
      });
      navigate('/login');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'فشل التسجيل',
        description: handleDatabaseError(error),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'كلمة مرور ضعيفة',
        description: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.',
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'كلمات المرور غير متطابقة',
        description: 'يرجى التأكد من تطابق كلمة المرور.',
      });
      return;
    }
    mutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <img
            src="/logo.png"
            alt="شعار التطبيق"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-lg mb-4"
          />
          <h1 className="text-xl sm:text-2xl font-bold text-foreground text-center">
            نظام إدارة الأقساط
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            إنشاء حساب جديد
          </p>
        </div>

        <Card className="shadow-xl border-border/50 backdrop-blur-sm">
          <CardHeader className="text-center pb-4 px-4 sm:px-6">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg sm:text-xl">إنشاء حساب جديد</CardTitle>
            <CardDescription className="text-sm">
              أدخل بياناتك لإنشاء حساب في النظام
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-right block text-sm">
                  البريد الإلكتروني
                </Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pr-10 text-left h-11"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-right block text-sm">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10 text-left h-11"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  يجب أن تكون كلمة المرور 6 أحرف على الأقل
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-right block text-sm">
                  تأكيد كلمة المرور
                </Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10 pl-10 text-left h-11"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-base"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 ml-2" />
                    إنشاء حساب
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-0 px-4 sm:px-6 pb-6">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">أو</span>
              </div>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              لديك حساب بالفعل؟{' '}
              <Link
                to="/login"
                className="text-primary font-medium hover:text-primary/80 hover:underline transition-colors"
              >
                تسجيل الدخول
              </Link>
            </div>
          </CardFooter>
        </Card>

        {/* Notice */}
        <div className="mt-4 p-3 sm:p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
          <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">
            ⚠️ بعد إنشاء الحساب، ستحتاج إلى انتظار موافقة المدير للوصول إلى النظام.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 نظام إدارة الأقساط. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;