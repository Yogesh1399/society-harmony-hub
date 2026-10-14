import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Auth
import { AuthProvider } from "@/components/auth/AuthProvider";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

// Layout
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Dashboard from "@/pages/dashboard/Dashboard";
import FlatsPage from "@/pages/flats/FlatsPage";
import MembersPage from "@/pages/members/MembersPage";
import MemberPortal from "@/pages/members/MemberPortal";
import IncomePage from "@/pages/income/IncomePage";
import ExpensePage from "@/pages/expenses/ExpensePage";
import ReportsPage from "@/pages/reports/ReportsPage";
import NoticesPage from "@/pages/notices/NoticesPage";
import ComplaintsPage from "@/pages/complaints/ComplaintsPage";
import SuperAdminDashboard from "@/pages/super-admin/SuperAdminDashboard";
import SocietyRegistration from "@/pages/super-admin/SocietyRegistration";
import SupportDashboard from "@/pages/super-admin/SupportDashboard";
import UserManagement from "@/pages/super-admin/UserManagement";
import SettingsPage from "@/pages/settings/SettingsPage";
import TenantsPage from "@/pages/tenants/TenantsPage";
import TenantPortal from "@/pages/tenants/TenantPortal";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import CommitteePage from "@/pages/committee/CommitteePage";
import DocumentsPage from "@/pages/documents/DocumentsPage";
import AdminControllerPage from "@/pages/admin/AdminControllerPage";
import MaintenancePage from "@/pages/maintenance/MaintenancePage";
import ApprovalsPage from "@/pages/approvals/ApprovalsPage";
import BankReconciliationPage from "@/pages/bank/BankReconciliationPage";
import VendorManagementPage from "@/pages/vendors/VendorManagementPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground">This page is under construction</p>
    </div>
  </div>
);

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Protected Routes with App Layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/flats" element={<FlatsPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/my-profile" element={<MemberPortal />} />
              <Route path="/my-tenant-profile" element={<TenantPortal />} />
              <Route path="/income" element={<IncomePage />} />
              <Route path="/expenses" element={<ExpensePage />} />
              <Route path="/tenants" element={<TenantsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/committee" element={<CommitteePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/notices" element={<NoticesPage />} />
              <Route path="/complaints" element={<ComplaintsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/admin-controller" element={<AdminControllerPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
              <Route path="/bank-reconciliation" element={<BankReconciliationPage />} />
              <Route path="/vendors" element={<VendorManagementPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<MemberPortal />} />
              <Route path="/super-admin" element={<SuperAdminDashboard />} />
              <Route path="/super-admin/societies" element={<SocietyRegistration />} />
              <Route path="/super-admin/support" element={<SupportDashboard />} />
              <Route path="/super-admin/users" element={<UserManagement />} />
            </Route>
            
            {/* Unauthorized */}
            <Route 
              path="/unauthorized" 
              element={
                <div className="flex items-center justify-center min-h-screen bg-background">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-destructive mb-4">Access Denied</h1>
                    <p className="text-muted-foreground mb-6">You don't have permission to access this page.</p>
                    <a href="/dashboard" className="text-primary hover:underline">Go to Dashboard</a>
                  </div>
                </div>
              } 
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
