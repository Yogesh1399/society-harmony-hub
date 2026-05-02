import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, AppRole } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
  requireSociety?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireSociety = false 
}: ProtectedRouteProps) {
  const location = useLocation();
  const { 
    session, 
    isLoading, 
    currentSocietyId,
    isSuperAdmin,
    getCurrentRole 
  } = useAuthStore();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  const currentRole = getCurrentRole();
  const isSuper = isSuperAdmin();

  if (allowedRoles && !isSuper) {
    if (!currentRole || !allowedRoles.includes(currentRole)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
