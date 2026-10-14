import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileNav } from './MobileNav';
import { PermissionsDebugPanel } from '@/components/dev/PermissionsDebugPanel';

interface AppLayoutProps {
  title?: string;
}

export function AppLayout({ title }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        
        {/* Main Content */}
        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader title={title} />
          
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
          
          {/* Mobile Bottom Navigation */}
          <MobileNav />
        </div>
      </div>
      <PermissionsDebugPanel />
    </SidebarProvider>
  );
}
