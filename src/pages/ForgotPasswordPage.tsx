import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { handleDatabaseError } from '@/lib/errorHandling';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: 'تم إرسال رابط إعادة تعيين كلمة المرور',
        description: 'يرجى التحقق من بريدك الإلكتروني',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: handleDatabaseError(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">نسيت كلمة المرور؟</CardTitle>
          <CardDescription className="text-center">
            {sent 
              ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
              : 'أدخل بريدك الإلكتروني لإعادة تعيين كلمة المرور'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  البريد الإلكتروني
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ادخل بريدك الإلكتروني"
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
              </Button>

              <div className="text-center">
                <Link 
                  to="/login" 
                  className="text-sm text-primary hover:underline inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  العودة لتسجيل الدخول
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                إذا كان البريد الإلكتروني موجودًا في نظامنا، ستتلقى رسالة تحتوي على تعليمات لإعادة تعيين كلمة المرور.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">العودة لتسجيل الدخول</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
