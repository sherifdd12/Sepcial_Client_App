import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "فشل تسجيل الدخول",
        description: "حدث خطأ أثناء تسجيل الدخول. يرجى التحقق من البيانات والمحاولة مرة أخرى.",
      });
      setIsLoading(false);
    } else if (data.session) {
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحبا بعودتك!",
      });
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <img
            src="/logo.png?v=2"
            alt="شعار التطبيق"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-lg mb-4"
          />
          <h1 className="text-xl sm:text-2xl font-bold text-foreground text-center">
            نظام إدارة الأقساط
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            إدارة شاملة للمبيعات والعملاء
          </p>
        </div>

        <Card className="shadow-xl border-border/50 backdrop-blur-sm">
          <CardHeader className="text-center pb-4 px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl">تسجيل الدخول</CardTitle>
            <CardDescription className="text-sm">
              أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى حسابك
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 px-4 sm:px-6">
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
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
                <div className="flex justify-start">
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
                  >
                    نسيت كلمة المرور؟
                  </Link>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 px-4 sm:px-6 pb-6">
              <Button
                type="submit"
                className="w-full h-11 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  "تسجيل الدخول"
                )}
              </Button>
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">أو</span>
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                ليس لديك حساب؟{" "}
                <Link
                  to="/register"
                  className="text-primary font-medium hover:text-primary/80 hover:underline transition-colors"
                >
                  إنشاء حساب جديد
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 نظام إدارة الأقساط. جميع الحقوق محفوظة.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
