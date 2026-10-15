import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAccess } from '@/hooks/useAccess';

interface RequireModuleProps {
  /** Permission module key, e.g. 'income'. Omit for admin/super-only routes. */
  module?: string;
  /** Only society_admin or super_admin may enter. */
  adminOnly?: boolean;
  /** Only super_admin may enter. */
  superOnly?: boolean;
  children: ReactNode;
}

/**
 * Route-level gate. Without this, hiding a link in the sidebar means
 * nothing — anyone can still type /income in the address bar and land on
 * the page. The database still refuses the writes, but the resident sees
 * a screen full of the society's finances that they were never meant to
 * open.
 */
export function RequireModule({ module, adminOnly, superOnly, children }: RequireModuleProps) {
  const { can, isFullAccess, isSuper, isLoading } = useAccess();

  if (superOnly) {
    return isSuper ? <>{children}</> : <Navigate to="/unauthorized" replace />;
  }

  if (adminOnly) {
    return isFullAccess ? <>{children}</> : <Navigate to="/unauthorized" replace />;
  }

  if (!module) return <>{children}</>;

  // Don't bounce someone out while we are still finding out who they are.
  if (isLoading && !isFullAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return can(module, 'view') ? <>{children}</> : <Navigate to="/unauthorized" replace />;
}
