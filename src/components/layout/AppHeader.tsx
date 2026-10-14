import { Menu, Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const { profile, getCurrentRole, setCurrentSocietyId } = useAuthStore();
  const { currentSociety, societies, setCurrentSociety, setFeatures } = useSocietyStore();
  const queryClient = useQueryClient();

  const currentRole = getCurrentRole();

  // Switching society must also reload that society's feature flags and
  // drop every cached query, otherwise the previous society's data stays
  // on screen for as long as it remains fresh.
  const handleSwitchSociety = async (society: typeof societies[number]) => {
    if (society.id === currentSociety?.id) return;

    setCurrentSocietyId(society.id);
    setCurrentSociety(society);

    const { data: features, error } = await supabase
      .from('feature_settings')
      .select('*')
      .eq('society_id', society.id)
      .maybeSingle();

    if (error) {
      toast.error('Could not load settings for this society.');
    } else {
      setFeatures(features ?? null);
    }

    await queryClient.invalidateQueries();
    toast.success(`Switched to ${society.name}`);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />
      
      <div className="flex flex-1 items-center gap-4">
        {title && (
          <h1 className="text-xl font-semibold text-foreground hidden md:block">
            {title}
          </h1>
        )}
        
        {/* Search - hidden on mobile */}
        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-9 bg-muted/50"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Society Selector - for multi-society users */}
        {societies.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden md:flex">
                {currentSociety?.name || 'Select Society'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Switch Society</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {societies.map((society) => (
                <DropdownMenuItem
                  key={society.id}
                  onClick={() => handleSwitchSociety(society)}
                  className={society.id === currentSociety?.id ? 'bg-accent' : ''}
                >
                  {society.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
            3
          </span>
        </Button>

        {/* User Menu - visible on larger screens */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="hidden md:flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.profile_photo_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start text-sm">
                <span className="font-medium">{profile?.full_name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {currentRole?.replace('_', ' ')}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Sign Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
