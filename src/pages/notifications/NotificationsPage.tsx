import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow } from 'date-fns';
import { Bell, BellOff, Check, CheckCheck, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export default function NotificationsPage() {
  const { currentSocietyId, user, getCurrentRole } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const currentRole = getCurrentRole();
  const isAdmin = currentRole === 'super_admin' || currentRole === 'society_admin';

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('society_id', currentSocietyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: reads } = useQuery({
    queryKey: ['notification_reads', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);
      return data?.map(r => r.notification_id) || [];
    },
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ['notification_settings', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return null;
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('society_id', currentSocietyId)
        .maybeSingle();
      return data;
    },
    enabled: !!currentSocietyId,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('notification_reads').insert({
        notification_id: notificationId,
        user_id: user.id,
      });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_reads'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user || !notifications) return;
      const unread = notifications.filter(n => !reads?.includes(n.id));
      const inserts = unread.map(n => ({ notification_id: n.id, user_id: user.id }));
      if (inserts.length > 0) {
        const { error } = await supabase.from('notification_reads').insert(inserts);
        if (error && !error.message.includes('duplicate')) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_reads'] });
      toast({ title: 'All notifications marked as read' });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async (updates: Record<string, boolean>) => {
      if (!settings) return;
      const { error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_settings'] });
      toast({ title: 'Settings updated' });
    },
  });

  const unreadCount = notifications?.filter(n => !reads?.includes(n.id)).length || 0;

  const typeIcons: Record<string, string> = {
    payment: '💰',
    notice: '📢',
    complaint: '⚠️',
    general: '🔔',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={() => markAllReadMutation.mutate()}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark All Read
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" /> Settings
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
          <TabsTrigger value="payment">Payments</TabsTrigger>
          <TabsTrigger value="notice">Notices</TabsTrigger>
          <TabsTrigger value="complaint">Complaints</TabsTrigger>
        </TabsList>

        {['all', 'unread', 'payment', 'notice', 'complaint'].map(tab => (
          <TabsContent key={tab} value={tab}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-2">
                {notifications
                  ?.filter(n => {
                    if (tab === 'unread') return !reads?.includes(n.id);
                    if (tab !== 'all') return n.type === tab;
                    return true;
                  })
                  .map(notification => {
                    const isRead = reads?.includes(notification.id);
                    return (
                      <Card
                        key={notification.id}
                        className={`cursor-pointer transition-all ${!isRead ? 'border-primary/30 bg-primary/5' : 'hover:shadow-sm'}`}
                        onClick={() => !isRead && markReadMutation.mutate(notification.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{typeIcons[notification.type] || '🔔'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={`font-medium truncate ${!isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {notification.title}
                                </h3>
                                {!isRead && <Badge variant="default" className="text-xs shrink-0">New</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(notification.created_at!), { addSuffix: true })}
                              </p>
                            </div>
                            {isRead && <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                {notifications?.filter(n => {
                  if (tab === 'unread') return !reads?.includes(n.id);
                  if (tab !== 'all') return n.type === tab;
                  return true;
                }).length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <BellOff className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <h3 className="mt-4 text-lg font-semibold">No notifications</h3>
                      <p className="text-muted-foreground">You're all caught up!</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
            <DialogDescription>Control which notifications are sent to members</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="payment-notify">Payment notifications to admin</Label>
              <Switch
                id="payment-notify"
                checked={settings?.notify_payment_to_admin ?? true}
                onCheckedChange={(v) => updateSettingMutation.mutate({ notify_payment_to_admin: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notice-notify">Notice notifications to all</Label>
              <Switch
                id="notice-notify"
                checked={settings?.notify_notice_to_all ?? true}
                onCheckedChange={(v) => updateSettingMutation.mutate({ notify_notice_to_all: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="complaint-admin">Complaint notifications to admin</Label>
              <Switch
                id="complaint-admin"
                checked={settings?.notify_complaint_to_admin ?? true}
                onCheckedChange={(v) => updateSettingMutation.mutate({ notify_complaint_to_admin: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="complaint-member">Complaint updates to member</Label>
              <Switch
                id="complaint-member"
                checked={settings?.notify_complaint_update_to_member ?? true}
                onCheckedChange={(v) => updateSettingMutation.mutate({ notify_complaint_update_to_member: v })}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
