import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useCommitteeRole } from '@/hooks/useCommitteeRole';
import { format, addDays } from 'date-fns';
import { Plus, Search, ShieldOff, Clock, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const RESOURCE_TYPES = [
  { value: 'all_financial', label: 'All Financial Records' },
  { value: 'income', label: 'Income Register' },
  { value: 'expense', label: 'Expense Register' },
  { value: 'balance_sheet', label: 'Balance Sheet' },
  { value: 'audit', label: 'Audit Documents' },
  { value: 'documents', label: 'Society Documents' },
];

const DURATIONS = [7, 15, 30, 60, 90];

export function TemporaryAccessGrants() {
  const { user, currentSocietyId } = useAuthStore();
  const { isChairman } = useCommitteeRole();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [resourceType, setResourceType] = useState('all_financial');
  const [duration, setDuration] = useState('15');
  const [notes, setNotes] = useState('');

  const { data: grants } = useQuery({
    queryKey: ['temp-access-grants', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('temporary_access_grants')
        .select('*')
        .eq('society_id', currentSocietyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Enrich with profile names (avoid relational joins on profiles RLS-restricted)
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    grants?.forEach((g: any) => { ids.add(g.granted_to_user_id); ids.add(g.granted_by_user_id); });
    return Array.from(ids);
  }, [grants]);

  const { data: profileMap } = useQuery({
    queryKey: ['grant-profiles', userIds],
    queryFn: async () => {
      const map: Record<string, string> = {};
      if (!userIds.length) return map;
      const { data } = await supabase.from('members').select('user_id, full_name').in('user_id', userIds as any);
      data?.forEach((m: any) => { if (m.user_id) map[m.user_id] = m.full_name; });
      return map;
    },
    enabled: !!userIds.length,
  });

  const { data: members } = useQuery({
    queryKey: ['members-with-user', currentSocietyId, memberSearch],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      let q = supabase.from('members').select('id, full_name, user_id, mobile, flats(flat_number, wing)')
        .eq('society_id', currentSocietyId).eq('is_active', true).not('user_id', 'is', null).limit(20);
      if (memberSearch.trim()) q = q.ilike('full_name', `%${memberSearch.trim()}%`);
      const { data } = await q;
      return data || [];
    },
    enabled: !!currentSocietyId && open,
  });

  const createGrant = useMutation({
    mutationFn: async () => {
      if (!currentSocietyId || !selectedMemberId || !user?.id) throw new Error('Missing info');
      const member = members?.find(m => m.id === selectedMemberId);
      if (!member?.user_id) throw new Error('Member has no linked user account');
      const validTo = format(addDays(new Date(), Number(duration)), 'yyyy-MM-dd');
      const { error } = await supabase.from('temporary_access_grants').insert({
        society_id: currentSocietyId,
        granted_to_user_id: member.user_id,
        granted_by_user_id: user.id,
        resource_type: resourceType,
        valid_to: validTo,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temp-access-grants'] });
      toast({ title: 'Access granted' });
      setOpen(false);
      setSelectedMemberId(''); setNotes(''); setMemberSearch('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const revokeGrant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('temporary_access_grants').update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_by: user?.id,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['temp-access-grants'] });
      toast({ title: 'Access revoked' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const grantStatus = (g: any) => {
    if (g.is_revoked) return { label: 'Revoked', variant: 'destructive' as const };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const validTo = new Date(g.valid_to);
    if (validTo < today) return { label: 'Expired', variant: 'outline' as const };
    return { label: 'Active', variant: 'default' as const };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Temporary Access Grants</CardTitle>
            <CardDescription>
              Grant time-limited view-only access to financial records.
              {!isChairman && <span className="ml-1 text-destructive">(Chairman/Admin only)</span>}
            </CardDescription>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!isChairman}>
            <Plus className="mr-2 h-4 w-4" /> Grant Access
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!grants?.length ? (
          <div className="text-center py-10 text-muted-foreground">
            <ShieldOff className="mx-auto h-10 w-10 mb-2 opacity-40" />
            No grants yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Granted To</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grants.map((g: any) => {
                const s = grantStatus(g);
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{profileMap?.[g.granted_to_user_id] || '—'}</TableCell>
                    <TableCell className="capitalize">{g.resource_type.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(g.valid_to), 'dd MMM yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{profileMap?.[g.granted_by_user_id] || '—'}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {!g.is_revoked && isChairman && (
                        <Button size="sm" variant="ghost" onClick={() => revokeGrant.mutate(g.id)}>Revoke</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Temporary Access</DialogTitle>
            <DialogDescription>Read-only access expires automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search Member</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 h-11" placeholder="Type a name..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
              </div>
              {!!members?.length && (
                <div className="mt-2 max-h-40 overflow-y-auto border rounded-md divide-y">
                  {members.map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setSelectedMemberId(m.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selectedMemberId === m.id ? 'bg-muted' : ''}`}
                    >
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(m.flats as any)?.wing ? `${(m.flats as any).wing}-` : ''}{(m.flats as any)?.flat_number || ''} {m.mobile && `· ${m.mobile}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Resource</Label>
                <Select value={resourceType} onValueChange={setResourceType}>
                  <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (days)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map(d => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input className="mt-1 h-11" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for access..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createGrant.mutate()} disabled={!selectedMemberId || createGrant.isPending}>
              {createGrant.isPending ? 'Granting...' : 'Grant Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
