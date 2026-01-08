import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Receipt,
  DollarSign,
  LogOut,
  Upload,
  Settings,
  Menu,
  ChevronDown,
  User,
  Brain,
  CreditCard,
  MoreHorizontal,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  ShieldCheck,
  LineChart,
  Bot,
  Database,
  Globe,
  Clock,
  Gavel,
  Wallet,
  Shield,
  Briefcase
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

const NavItem = ({ item, onClick, isMobile = false }: { item: any, onClick?: () => void, isMobile?: boolean }) => {
  const Icon = item.icon;

  if (item.isExternal) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={`flex items-center space-x-reverse space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:bg-muted hover:text-foreground ${isMobile ? 'w-full' : ''}`}
      >
        <div className="relative">
          <Icon className="h-4 w-4 flex-shrink-0" />
        </div>
        <span className="truncate">{item.label}</span>
      </a>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center space-x-reverse space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${isMobile ? 'w-full' : ''}`
      }
    >
      <div className="relative">
        <Icon className="h-4 w-4 flex-shrink-0" />
        {item.badge > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full min-w-[16px] h-4 flex items-center justify-center">
            {item.badge}
          </span>
        )}
      </div>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
};

const Header = () => {
  const { hasRole, signOut, session } = useAuth();
  const { hasPermission } = usePermissions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Fetch pending Tap payments count
  const { data: pendingTapCount = 0 } = useQuery({
    queryKey: ["pending-tap-payments-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("tap_webhook_logs")
        .select("*", { count: "exact", head: true })
        .or("status.eq.pending,status.eq.unmatched");

      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 30000,
    enabled: !!session,
  });

  // Fetch app settings for logo and name
  const { data: appSettings } = useQuery({
    queryKey: ["app-settings-header"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*");

      if (error) return {};

      const settingsMap: any = {};
      data.forEach((s: any) => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      return settingsMap;
    },
  });

  const appLogo = appSettings?.app_logo || "/logo.png";
  const appName = appSettings?.app_name || "نظام إدارة الأقساط";
  const appDescription = appSettings?.app_description || "إدارة شاملة للمبيعات";

  // Get email from session
  const userEmail = session?.user?.email || '';

  // Handle sign out with navigation
  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const getRoleLabel = () => {
    if (hasRole('admin')) return 'مدير النظام';
    if (hasRole('staff')) return 'موظف';
    return 'بانتظار الموافقة';
  };

  const getUserInitials = () => {
    if (!userEmail) return "U";
    return userEmail.substring(0, 2).toUpperCase();
  };

  const navigationItems: { to: string, icon: any, label: string, badge: number, isExternal?: boolean, permission?: string }[] = [

    // Main Items
    { to: "/", icon: LayoutDashboard, label: "لوحة التحكم", badge: 0, permission: "dashboard.view" },
    { to: "/customers", icon: Users, label: "العملاء", badge: 0, permission: "customers.view" },
    { to: "/transactions", icon: Receipt, label: "المعاملات", badge: 0, permission: "transactions.view" },
    { to: "/payments", icon: DollarSign, label: "الدفعات", badge: 0, permission: "payments.view" },

    // More Menu Items
    { to: "/overdue-tracking", icon: AlertTriangle, label: "المتأخرين", badge: 0, permission: "reports.view" },
    { to: "/ai-analysis", icon: Brain, label: "AI تحليلات", badge: 0, permission: "reports.view" },
    { to: "/business-insights", icon: LineChart, label: "تحليلات الميزانية", badge: 0, permission: "reports.view" },
    { to: "/gemini-ai", icon: Bot, label: "AI مساعد", badge: 0, permission: "reports.view" },
    { to: "/import", icon: Upload, label: "استيراد", badge: 0, permission: "settings.edit" },
    { to: "/data-validation", icon: Database, label: "فحص البيانات", badge: 0, permission: "settings.edit" },
    { to: "/financial-reports", icon: TrendingUp, label: "التقارير", badge: 0, permission: "reports.view" },
    { to: "/advanced-reports", icon: FileSpreadsheet, label: "تقارير متقدمة", badge: 0, permission: "reports.view" },
    { to: "/tap-payments", icon: CreditCard, label: "مدفوعات Tap", badge: pendingTapCount, permission: "payments.view" },
    { to: "/legal-cases", icon: Gavel, label: "إدارة القضايا", badge: 0, permission: "customers.view" },
    { to: "/expenses", icon: Wallet, label: "المصروفات", badge: 0, permission: "expenses.view" },
    { to: "/employees", icon: Briefcase, label: "الموظفين", badge: 0, permission: "employees.view" },

    { to: "/settings", icon: Settings, label: "الإعدادات", badge: 0, permission: "settings.view" },
  ];

  if (hasPermission('users.manage')) {
    navigationItems.push({ to: "/admin/users", icon: ShieldCheck, label: "إدارة المستخدمين", badge: 0 });
    navigationItems.push({ to: "/admin/logs", icon: Clock, label: "سجلات النشاط", badge: 0 });
  }

  if (hasPermission('roles.manage')) {
    navigationItems.push({ to: "/admin/roles", icon: Shield, label: "إدارة الأدوار", badge: 0 });
  }

  // Add external links from settings
  [1, 2, 3].forEach(i => {
    const label = appSettings?.[`ext_link_${i}_label`];
    const url = appSettings?.[`ext_link_${i}_url`];
    if (label && url) {
      navigationItems.push({ to: url, icon: Globe, label: label, badge: 0, isExternal: true });
    }
  });

  // Filter items based on permissions
  const filteredNavItems = navigationItems.filter(item => {
    if (item.permission) {
      return hasPermission(item.permission);
    }
    return true;
  });

  return (
    <header className="bg-card/95 backdrop-blur-md shadow-card border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Logo Section */}
          <div className="flex items-center space-x-reverse space-x-2 sm:space-x-3 min-w-0">
            <img
              src={appLogo}
              alt="شعار التطبيق"
              className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl shadow-sm flex-shrink-0 object-contain bg-muted/50"
            />
            <div className="hidden xs:block min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-foreground truncate">
                {appName}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {appDescription}
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-reverse space-x-1 flex-1 justify-center">
            {filteredNavItems.slice(0, 4).map((item) => (
              <NavItem key={item.to} item={item} />
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-reverse space-x-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg">
                  <MoreHorizontal className="h-4 w-4 ml-1" />
                  <span>المزيد</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {filteredNavItems.slice(4).map((item) => {
                  const Icon = item.icon;
                  if (item.isExternal) {
                    return (
                      <DropdownMenuItem key={item.to} asChild>
                        <a
                          href={item.to}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-reverse space-x-2 w-full px-2 py-2 rounded-md text-sm text-foreground hover:bg-muted"
                        >
                          <Icon className="h-4 w-4 ml-2" />
                          <span>{item.label}</span>
                        </a>
                      </DropdownMenuItem>
                    );
                  }
                  return (
                    <DropdownMenuItem key={item.to} asChild>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex items-center space-x-reverse space-x-2 w-full px-2 py-2 rounded-md text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                          }`
                        }
                      >
                        <Icon className="h-4 w-4 ml-2" />
                        <span>{item.label}</span>
                        {item.badge > 0 && (
                          <span className="mr-auto bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Right Section */}
          <div className="flex items-center space-x-reverse space-x-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden md:flex items-center space-x-reverse space-x-2 px-2 sm:px-3 max-w-[200px]">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs sm:text-sm text-muted-foreground max-w-[100px] truncate hidden lg:block">
                    {userEmail}
                  </span>
                  <ChevronDown className="h-3 w-3 sm:h-4 w-4 text-muted-foreground flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="flex items-center space-x-reverse space-x-2">
                  <User className="h-4 w-4" />
                  <span>حسابي</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-muted-foreground text-xs">
                  {userEmail}
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center space-x-reverse space-x-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                    {getRoleLabel()}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 ml-2" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={handleSignOut} variant="outline" size="sm" className="hidden lg:flex">
              <LogOut className="h-4 w-4 ml-2" />
              <span className="hidden xl:inline">خروج</span>
            </Button>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0">
                <SheetHeader className="text-right p-4 pb-4 border-b border-border">
                  <SheetTitle className="flex items-center space-x-reverse space-x-3">
                    <img
                      src={appLogo}
                      alt="شعار التطبيق"
                      className="w-10 h-10 rounded-xl object-contain bg-muted/50"
                    />
                    <div>
                      <h2 className="text-base font-bold">{appName}</h2>
                      <p className="text-xs text-muted-foreground font-normal">{appDescription}</p>
                    </div>
                  </SheetTitle>
                </SheetHeader>

                <div className="p-4 border-b border-border bg-muted/30">
                  <div className="flex items-center space-x-reverse space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {userEmail}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-block mt-1">
                        {getRoleLabel()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <nav className="flex flex-col space-y-1 p-3">
                    {filteredNavItems.map((item) => (
                      <NavItem
                        key={item.to}
                        item={item}
                        onClick={() => setMobileMenuOpen(false)}
                        isMobile
                      />
                    ))}
                  </nav>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
                  <Button
                    onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                    variant="destructive"
                    className="w-full"
                    size="sm"
                  >
                    <LogOut className="h-4 w-4 ml-2" />
                    تسجيل الخروج
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;