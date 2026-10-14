import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { Plus, MessageSquare, Search, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ComplaintForm } from '@/components/complaints/ComplaintForm';
import type { Database } from '@/integrations/supabase/db-types';

type ComplaintStatus = Database['public']['Enums']['complaint_status'];
type ComplaintPriority = Database['public']['Enums']['complaint_priority'];

const statusColors: Record<string, string> = {
  open: 'bg-destructive/10 text-destructive',
  in_progress: 'bg-warning/10 text-warning',
  resolved: 'bg-primary/10 text-primary',
  closed: 'bg-muted text-muted-foreground',
};

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-destructive/10 text-destructive',
};

export default function ComplaintsPage() {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [resolvingComplaint, setResolvingComplaint] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['complaints', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('complaints')
        .select('*, flats(*)')
        .eq('society_id', currentSocietyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: ComplaintStatus; notes?: string }) => {
      const updateData: any = { status };
      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }
      if (notes && notes.trim()) {
        updateData.resolution_notes = notes.trim();
      }
      const { error } = await supabase.from('complaints').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      toast({ title: 'Status updated' });
      setResolvingComplaint(null);
      setResolutionNotes('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const filtered = complaints?.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    open: complaints?.filter(c => c.status === 'open').length || 0,
    in_progress: complaints?.filter(c => c.status === 'in_progress').length || 0,
    resolved: complaints?.filter(c => c.status === 'resolved' || c.status === 'closed').length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Complaints</h1>
          <p className="text-muted-foreground">Track and manage society complaints</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Raise Complaint
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-destructive">{stats.open}</p>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-warning">{stats.in_progress}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-primary">{stats.resolved}</p>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search complaints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 h-12">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Complaints List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No complaints found</h3>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'No complaints raised yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered?.map((complaint) => (
            <Card key={complaint.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground">{complaint.title}</h3>
                      <Badge className={statusColors[complaint.status || 'open']}>
                        {(complaint.status || 'open').replace('_', ' ')}
                      </Badge>
                      <Badge className={priorityColors[complaint.priority || 'medium']}>
                        {complaint.priority || 'medium'}
                      </Badge>
                    </div>
                    {complaint.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{complaint.description}</p>
                    )}
                    {Array.isArray((complaint as any).photo_urls) && (complaint as any).photo_urls.length > 0 && (
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {(complaint as any).photo_urls.slice(0, 4).map((url: string, idx: number) => (
                          <a key={idx} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="" className="h-16 w-16 object-cover rounded border" />
                          </a>
                        ))}
                      </div>
                    )}
                    {(complaint as any).resolution_notes && (
                      <p className="text-xs italic text-muted-foreground mb-1">
                        <span className="font-medium not-italic">Resolution:</span> {(complaint as any).resolution_notes}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {(complaint as any).flats?.flat_number && (
                        <span>Flat: {(complaint as any).flats.flat_number}</span>
                      )}
                      {complaint.category && <span>• {complaint.category}</span>}
                      <span>• {format(new Date(complaint.created_at!), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {complaint.status === 'open' && (
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: complaint.id, status: 'in_progress' })}>
                          Mark In Progress
                        </DropdownMenuItem>
                      )}
                      {(complaint.status === 'open' || complaint.status === 'in_progress') && (
                        <DropdownMenuItem onClick={() => { setResolvingComplaint(complaint); setResolutionNotes(''); }}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Resolved
                        </DropdownMenuItem>
                      )}
                      {complaint.status === 'resolved' && (
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: complaint.id, status: 'closed' })}>
                          Close Complaint
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Complaint Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise Complaint</DialogTitle>
            <DialogDescription>Submit a new complaint for the society</DialogDescription>
          </DialogHeader>
          <ComplaintForm onClose={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Resolution Notes Dialog */}
      <Dialog open={!!resolvingComplaint} onOpenChange={(open) => { if (!open) { setResolvingComplaint(null); setResolutionNotes(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Resolved</DialogTitle>
            <DialogDescription>
              Add resolution notes for "{resolvingComplaint?.title}". This will be visible to the member.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe how the issue was resolved..."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolvingComplaint(null); setResolutionNotes(''); }}>
              Cancel
            </Button>
            <Button
              disabled={updateStatusMutation.isPending}
              onClick={() => updateStatusMutation.mutate({
                id: resolvingComplaint.id,
                status: 'resolved',
                notes: resolutionNotes,
              })}
            >
              {updateStatusMutation.isPending ? 'Saving...' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
