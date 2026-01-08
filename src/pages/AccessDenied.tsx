import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const AccessDenied = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    const handleLogout = async () => {
        await signOut();
        navigate("/login");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
                        <ShieldAlert className="w-10 h-10 text-destructive" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-foreground">
                    تم رفض الوصول
                </h1>

                <p className="text-muted-foreground">
                    عذراً، ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة. يرجى التأكد من تشغيل سكربت قاعدة البيانات الجديد أو التواصل مع مدير النظام.
                </p>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button variant="outline" onClick={handleLogout}>
                        تسجيل الخروج
                    </Button>
                    <Button onClick={() => window.location.reload()}>
                        إعادة المحاولة
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AccessDenied;
