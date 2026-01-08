import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const AuthLayout = () => {
  const { session, user, isLoading } = useAuth();

  // Show a loading state while the session is being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative flex flex-col items-center space-y-6">
          <img
            src="/logo.png"
            alt="شعار التطبيق"
            className="w-20 h-20 rounded-2xl shadow-lg animate-pulse"
          />
          <div className="flex items-center space-x-reverse space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-muted-foreground">جاري التحميل...</span>
          </div>
        </div>
      </div>
    );
  }

  // If there is no user session after loading, redirect to the login page
  if (!session || !user) {
    return <Navigate to="/login" replace />;
  }

  // If there is a user session, render the nested routes
  return <Outlet />;
};

export default AuthLayout;
