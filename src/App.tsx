import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AuthLayout from "@/components/layout/AuthLayout";
import MainLayout from "@/components/layout/MainLayout";
import AdminLayout from "@/components/layout/AdminLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import CustomersPage from "@/pages/CustomersPage";
import ApprovalsPage from "@/pages/Admin/ApprovalsPage";
import UsersPage from "@/pages/Admin/UsersPage";
import RolesPage from "@/pages/Admin/RolesPage";
import UserLogsPage from "@/pages/Admin/UserLogsPage";
import TransactionsPage from "@/pages/TransactionsPage";
import PaymentsPage from "@/pages/PaymentsPage";
import DataImportPage from "@/pages/DataImportPage";
import ReportsPage from "@/pages/ReportsPage";
import FinancialReportsPage from "@/pages/FinancialReportsPage";
import SettingsPage from "@/pages/SettingsPage";
import CloudStoragePage from "@/pages/CloudStoragePage";
import AIAnalysisPage from "@/pages/AIAnalysisPage";
import DataValidationPage from "@/pages/DataValidationPage";
import GeminiAIPage from "@/pages/GeminiAIPage";
import AdvancedReportsPage from "@/pages/AdvancedReportsPage";
import NotFound from "./pages/NotFound";
import OneDriveCallback from "./pages/OneDriveCallback";
import LegalCasesPage from "@/pages/LegalCasesPage";
import TapPaymentsPage from "@/pages/TapPaymentsPage";
import BusinessInsightsPage from "./pages/BusinessInsightsPage";
import OverdueTrackingPage from "./pages/OverdueTrackingPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import ExpensesPage from "./pages/ExpensesPage";
import EmployeesPage from "./pages/EmployeesPage";
import CustomerServicePage from "@/pages/CustomerServicePage";
import TasksPage from "@/pages/TasksPage";
import { PaymentNotificationListener } from "@/components/shared/PaymentNotificationListener";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

import AccessDenied from "@/pages/AccessDenied";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PaymentNotificationListener />
          <Routes>
            <Route path="/callback" element={<OneDriveCallback />} />
            <Route path="/payment-success" element={<PaymentSuccessPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route element={<AuthLayout />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={
                  <PermissionGuard permission="dashboard.view" fallback={<Navigate to="/access-denied" />}>
                    <DashboardPage />
                  </PermissionGuard>
                } />
                <Route path="/customers" element={
                  <PermissionGuard permission="customers.view" fallback={<Navigate to="/access-denied" />}>
                    <CustomersPage />
                  </PermissionGuard>
                } />
                <Route path="/transactions" element={
                  <PermissionGuard permission="transactions.view" fallback={<Navigate to="/access-denied" />}>
                    <TransactionsPage />
                  </PermissionGuard>
                } />
                <Route path="/payments" element={
                  <PermissionGuard permission="payments.view" fallback={<Navigate to="/access-denied" />}>
                    <PaymentsPage />
                  </PermissionGuard>
                } />
                <Route path="/import" element={<DataImportPage />} />
                <Route path="/reports" element={
                  <PermissionGuard permission="reports.view" fallback={<Navigate to="/access-denied" />}>
                    <ReportsPage />
                  </PermissionGuard>
                } />
                <Route path="/financial-reports" element={
                  <PermissionGuard permission="reports.view" fallback={<Navigate to="/access-denied" />}>
                    <FinancialReportsPage />
                  </PermissionGuard>
                } />
                <Route path="/settings" element={
                  <PermissionGuard permission="settings.view" fallback={<Navigate to="/access-denied" />}>
                    <SettingsPage />
                  </PermissionGuard>
                } />
                <Route path="/cloud-storage" element={<CloudStoragePage />} />
                <Route path="/ai-analysis" element={<AIAnalysisPage />} />
                <Route path="/data-validation" element={<DataValidationPage />} />
                <Route path="/gemini-ai" element={<GeminiAIPage />} />
                <Route path="/legal-cases" element={<LegalCasesPage />} />
                <Route path="/advanced-reports" element={<AdvancedReportsPage />} />
                <Route path="/tap-payments" element={<TapPaymentsPage />} />
                <Route path="/business-insights" element={<BusinessInsightsPage />} />
                <Route path="/overdue-tracking" element={<OverdueTrackingPage />} />
                <Route path="/expenses" element={
                  <PermissionGuard permission="expenses.view" fallback={<Navigate to="/access-denied" />}>
                    <ExpensesPage />
                  </PermissionGuard>
                } />
                <Route path="/employees" element={
                  <PermissionGuard permission="employees.view" fallback={<Navigate to="/access-denied" />}>
                    <EmployeesPage />
                  </PermissionGuard>
                } />
                <Route path="/customer-service" element={
                  <PermissionGuard permission="customers.view" fallback={<Navigate to="/access-denied" />}>
                    <CustomerServicePage />
                  </PermissionGuard>
                } />
                <Route path="/tasks" element={
                  <PermissionGuard permission="dashboard.view" fallback={<Navigate to="/access-denied" />}>
                    <TasksPage />
                  </PermissionGuard>
                } />
                <Route element={<AdminLayout />}>
                  <Route path="/admin/approvals" element={<ApprovalsPage />} />
                  <Route path="/admin/users" element={
                    <PermissionGuard permission="users.manage" fallback={<Navigate to="/access-denied" />}>
                      <UsersPage />
                    </PermissionGuard>
                  } />
                  <Route path="/admin/roles" element={
                    <PermissionGuard permission="roles.manage" fallback={<Navigate to="/access-denied" />}>
                      <RolesPage />
                    </PermissionGuard>
                  } />
                  <Route path="/admin/logs" element={<UserLogsPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
