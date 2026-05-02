import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { Plus, Bell, Search, Eye, Trash2, MoreHorizontal, CheckCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { NoticeForm } from '@/components/notices/NoticeForm';

export default function NoticesPage() {
  const { currentSocietyId, user, getCurrentRole } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewNotice, setViewNotice] = useState<any>(null);
  const [viewReads, setViewReads] = useState<any>(null);
  const currentRole = getCurrentRole();
  const isAdmin = currentRole === 'super_admin' || currentRole === 'society_admin' || currentRole === 'committee_member';

  const { data: notices, isLoading } = useQuery({
    queryKey: ['notices', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('society_id', currentSocietyId)
        .order('notice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Track which notices current user has read
  const { data: myReads } = useQuery({
    queryKey: ['notice_reads', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .eq('user_id', user.id);
      return data?.map(r => r.notice_id) || [];
    },
    enabled: !!user,
  });

  // For admin: fetch read counts per notice
  const { data: readCounts } = useQuery({
    queryKey: ['notice_read_counts', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId || !notices) return {};
      const counts: Record<string, number> = {};
      for (const notice of notices) {
        const { count } = await supabase
          .from('notice_reads')
          .select('*', { count: 'exact', head: true })
          .eq('notice_id', notice.id);
        counts[notice.id] = count || 0;
      }
      return counts;
    },
    enabled: !!currentSocietyId && isAdmin && !!notices?.length,
  });

  // Fetch read details for a specific notice
  const { data: readDetails } = useQuery({
    queryKey: ['notice_read_details', viewReads?.id],
    queryFn: async () => {
      if (!viewReads) return [];
      const { data } = await supabase
        .from('notice_reads')
        .select('user_id, read_at')
        .eq('notice_id', viewReads.id);
      if (!data?.length) return [];
      // Get profiles for these users
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      return data.map(d => ({
        ...d,
        profile: profiles?.find(p => p.id === d.user_id),
      }));
    },
    enabled: !!viewReads,
  });

  const markReadMutation = useMutation({
    mutationFn: async (noticeId: string) => {
      if (!user) return;
      const { error } = await supabase.from('notice_reads').insert({
        notice_id: noticeId,
        user_id: user.id,
      });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notice_reads'] });
      queryClient.invalidateQueries({ queryKey: ['notice_read_counts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast({ title: 'Notice deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleViewNotice = (notice: any) => {
    setViewNotice(notice);
    if (!myReads?.includes(notice.id)) {
      markReadMutation.mutate(notice.id);
    }
  };

  const filtered = notices?.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notices</h1>
          <p className="text-muted-foreground">Society notices and announcements</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Notice
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search notices..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base" />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No notices found</h3>
            <p className="text-muted-foreground">{searchQuery ? 'Try adjusting your search' : 'Create your first notice'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered?.map((notice) => {
            const isRead = myReads?.includes(notice.id);
            return (
              <Card key={notice.id} className={`hover:shadow-md transition-shadow ${!isRead ? 'border-primary/30 bg-primary/5' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleViewNotice(notice)}>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{notice.title}</h3>
                        {!isRead && <Badge variant="default" className="text-xs shrink-0">New</Badge>}
                        <Badge variant="outline" className="text-xs shrink-0">
                          {notice.visible_to === 'all' ? 'All Members' : notice.visible_to}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{notice.content}</p>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(notice.notice_date), 'dd MMM yyyy')}
                        </p>
                        {isAdmin && readCounts && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewReads(notice); }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <CheckCircle className="h-3 w-3" />
                            {readCounts[notice.id] || 0} viewed
                          </button>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewNotice(notice)}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewReads(notice)}>
                            <Users className="mr-2 h-4 w-4" /> View Reads
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteMutation.mutate(notice.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Notice Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Notice</DialogTitle>
            <DialogDescription>Post a new notice for society members</DialogDescription>
          </DialogHeader>
          <NoticeForm onClose={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* View Notice Dialog */}
      <Dialog open={!!viewNotice} onOpenChange={(open) => !open && setViewNotice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewNotice?.title}</DialogTitle>
            <DialogDescription>
              Posted on {viewNotice && format(new Date(viewNotice.notice_date), 'dd MMM yyyy')}
            </DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-foreground">{viewNotice?.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Reads Dialog */}
      <Dialog open={!!viewReads} onOpenChange={(open) => !open && setViewReads(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notice Read Status</DialogTitle>
            <DialogDescription>"{viewReads?.title}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {readDetails?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No one has viewed this notice yet.</p>
            ) : (
              readDetails?.map((read: any) => (
                <div key={read.user_id} className="flex items-center justify-between p-2 rounded-lg bg-accent/50">
                  <div>
                    <p className="text-sm font-medium">{read.profile?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{read.profile?.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(read.read_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
