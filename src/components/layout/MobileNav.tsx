import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  Bell,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

const mobileNavItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Flats', url: '/flats', icon: Building2 },
  { title: 'Income', url: '/income', icon: TrendingUp },
  { title: 'Notices', url: '/notices', icon: Bell },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t">
        <div className="flex items-center justify-around h-16 px-2">
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full py-2 px-1',
                  'transition-colors touch-manipulation',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-5 w-5 mb-1', isActive && 'scale-110')} />
                <span className="text-[10px] font-medium">{item.title}</span>
              </Link>
            );
          })}
          
          {/* More Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center justify-center flex-1 h-full py-2 px-1 text-muted-foreground hover:text-foreground transition-colors touch-manipulation">
                <Menu className="h-5 w-5 mb-1" />
                <span className="text-[10px] font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarProvider>
                <AppSidebar />
              </SidebarProvider>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      
      {/* Spacer for bottom nav */}
      <div className="h-16 md:hidden" />
    </>
  );
}
