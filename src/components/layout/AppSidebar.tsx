import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, UserCheck, UserCog, TrendingUp, TrendingDown,
  FileText, Bell, MessageSquare, FileArchive, Settings, ChevronDown, Building,
  LogOut, User, Shield, ShieldAlert, Calculator, Banknote, Lock,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { useAuth } from '@/hooks/useAuth';
import { useAccess } from '@/hooks/useAccess';
import { useCommitteeRole } from '@/hooks/useCommitteeRole';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
  adminOnly?: boolean;   // only super_admin / society_admin
  module?: string;       // permission key
}

// Member portal nav (always visible to that member, no permission check)
const PORTAL_NAV: NavItem[] = [
  { title: 'My Profile', url: '/my-profile', icon: User },
];

// Super-admin-only nav
const SUPER_NAV: NavItem[] = [
  { title: 'Platform Dashboard', url: '/super-admin', icon: LayoutDashboard },
  { title: 'Societies', url: '/super-admin/societies', icon: Building },
  { title: 'Users', url: '/super-admin/users', icon: Users },
  { title: 'Support', url: '/super-admin/support', icon: MessageSquare },
];

// All society-level nav items
const MAIN_NAV: NavItem[] = [
  { title: 'Dashboard',          url: '/dashboard',          icon: LayoutDashboard, module: 'dashboard'      },
  { title: 'Flats & Members',    url: '/flats',              icon: Building2,        module: 'flats'          },
  { title: 'Members',            url: '/members',            icon: Users,            module: 'members'        },
];
const MGMT_NAV: NavItem[] = [
  { title: 'Tenants',    url: '/tenants',    icon: UserCheck, feature: 'enable_tenant_management', module: 'tenants'   },
  { title: 'Committee',  url: '/committee',  icon: UserCog,   feature: 'enable_committee_management', module: 'committee' },
];
const FINANCE_NAV: NavItem[] = [
  { title: 'Income',             url: '/income',             icon: TrendingUp,   module: 'income'       },
  { title: 'Expenses',           url: '/expenses',           icon: TrendingDown, module: 'expenses'     },
  { title: 'Approvals',          url: '/approvals',          icon: ShieldAlert,  module: 'expenses'     },
  { title: 'Maintenance',        url: '/maintenance',        icon: Calculator,   module: 'maintenance'  },
  { title: 'Bank Reconciliation',url: '/bank-reconciliation',icon: Banknote,     module: 'expenses'     },
  { title: 'Reports',            url: '/reports',            icon: FileText,     module: 'reports'      },
];
const COMM_NAV: NavItem[] = [
  { title: 'Notices',       url: '/notices',       icon: Bell,          module: 'notices'       },
  { title: 'Notifications', url: '/notifications', icon: Bell,          module: 'notifications' },
  { title: 'Complaints',    url: '/complaints',    icon: MessageSquare, module: 'complaints'    },
];
const OTHER_NAV: NavItem[] = [
  { title: 'Vendors',           url: '/vendors',           icon: Building2, module: 'expenses' },
  { title: 'Documents',         url: '/documents',         icon: FileArchive, feature: 'enable_document_management', module: 'documents' },
  { title: 'Admin Controller',  url: '/admin-controller',  icon: Shield,      adminOnly: true },
  { title: 'Settings',          url: '/settings',          icon: Settings,    adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const { profile, isSuperAdmin, getCurrentRole, hasRole } = useAuthStore();
  const { currentSociety, isFeatureEnabled } = useSocietyStore();
  const { signOut } = useAuth();
  const { can, isFullAccess } = useAccess();
  const { isCommittee } = useCommitteeRole();

  const isSuper = isSuperAdmin();
  const currentRole = getCurrentRole();
  const isFlatOwner = hasRole('flat_owner');
  const isTenant = hasRole('tenant');

  // What a denied item looks like.
  //
  // For an admin or committee member, greying the item out is useful —
  // it tells them the module exists and that their group does not cover
  // it, so they know what to ask for.
  //
  // For a resident or tenant, a grey padlocked list of the society's
  // finance screens is just a tour of what they cannot have. Hide it.
  const denyState: 'dimmed' | 'hidden' =
    isFullAccess || isCommittee ? 'dimmed' : 'hidden';

  // Determine nav access for a given item.
  // The decision itself lives in useAccess, so this link and the page
  // behind it can never disagree.
  const getItemState = (item: NavItem): 'visible' | 'dimmed' | 'hidden' => {
    if (item.feature && !isFeatureEnabled(item.feature as any)) return 'hidden';
    if (item.adminOnly) return isFullAccess ? 'visible' : 'hidden';
    if (!item.module) return 'visible';
    return can(item.module, 'view') ? 'visible' : denyState;
  };

  const renderNavGroup = (label: string, items: NavItem[], forceShow = false) => {
    // Filter: only hide if ALL items are 'hidden'
    const processed = items.map(item => ({ item, state: getItemState(item) }));
    const anyVisible = processed.some(p => p.state !== 'hidden');
    if (!anyVisible && !forceShow) return null;

    return (
      <SidebarGroup key={label}>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {processed.map(({ item, state: itemState }) => {
              if (itemState === 'hidden') return null;
              const isDimmed = itemState === 'dimmed';
              const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + '/');

              const linkEl = (
                <NavLink
                  to={isDimmed ? '#' : item.url}
                  onClick={isDimmed ? (e) => e.preventDefault() : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full text-sm',
                    isActive && !isDimmed && 'bg-primary/10 text-primary font-medium',
                    !isActive && !isDimmed && 'hover:bg-accent hover:text-accent-foreground',
                    isDimmed && 'opacity-40 cursor-not-allowed select-none',
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && (
                    <span className="flex-1 truncate">{item.title}</span>
                  )}
                  {!collapsed && isDimmed && <Lock className="h-3 w-3 flex-shrink-0" />}
                </NavLink>
              );

              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    {isDimmed && collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                        <TooltipContent side="right">No permission: {item.title}</TooltipContent>
                      </Tooltip>
                    ) : isDimmed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                        <TooltipContent>You don't have access to {item.title}</TooltipContent>
                      </Tooltip>
                    ) : linkEl}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg flex-shrink-0">S</div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-foreground truncate">
                {currentSociety?.name || 'Society Manager'}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {currentRole?.replace(/_/g, ' ') || 'Loading...'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4 space-y-1">
        {isSuper && renderNavGroup('Platform', SUPER_NAV)}
        {(isFlatOwner || isTenant) && renderNavGroup('My Portal', PORTAL_NAV, true)}
        {!isTenant && renderNavGroup('Main', MAIN_NAV)}
        {!isTenant && renderNavGroup('Management', MGMT_NAV)}
        {!isTenant && renderNavGroup('Finance', FINANCE_NAV)}
        {renderNavGroup('Communication', COMM_NAV)}
        {!isTenant && renderNavGroup('Other', OTHER_NAV)}
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-accent transition-colors">
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarImage src={profile?.profile_photo_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex flex-col text-left flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{profile?.full_name || 'User'}</span>
                    <span className="text-xs text-muted-foreground truncate">{profile?.email}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <NavLink to="/my-profile" className="w-full cursor-pointer flex items-center gap-2">
                <User className="h-4 w-4" /> My Profile
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
