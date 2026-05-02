import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { Plus, UserCog, Search, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';

const committeeSchema = z.object({
  member_id: z.string().min(1, 'Select a member'),
  role: z.enum(['chairman', 'secretary', 'treasurer', 'member']),
  term_start: z.string().optional(),
  term_end: z.string().optional(),
});

type CommitteeFormValues = z.infer<typeof committeeSchema>;

const roleLabels: Record<string, string> = {
  chairman: 'Chairman',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  member: 'Committee Member',
};

const roleColors: Record<string, string> = {
  chairman: 'bg-primary/10 text-primary',
  secretary: 'bg-accent text-accent-foreground',
  treasurer: 'bg-secondary text-secondary-foreground',
  member: 'bg-muted text-muted-foreground',
};

export default function CommitteePage() {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  const { data: committeeMembers, isLoading } = useQuery({
    queryKey: ['committee', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('committee_members')
        .select('*, members(full_name, mobile, email, flats(flat_number, wing))')
        .eq('society_id', currentSocietyId)
        .order('role');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: members } = useQuery({
    queryKey: ['members-for-committee', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, flat_id, flats(flat_number, wing)')
        .eq('society_id', currentSocietyId)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId && isFormOpen,
  });

  const form = useForm<CommitteeFormValues>({
    resolver: zodResolver(committeeSchema),
    defaultValues: {
      member_id: '',
      role: 'member',
      term_start: '',
      term_end: '',
    },
  });

  const resetForm = (item?: any) => {
    form.reset({
      member_id: item?.member_id || '',
      role: item?.role || 'member',
      term_start: item?.term_start || '',
      term_end: item?.term_end || '',
    });
  };

  const mutation = useMutation({
    mutationFn: async (values: CommitteeFormValues) => {
      if (!currentSocietyId) throw new Error('No society');
      const payload = {
        society_id: currentSocietyId,
        member_id: values.member_id,
        role: values.role as any,
        term_start: values.term_start || null,
        term_end: values.term_end || null,
        is_active: true,
      };
      if (editItem) {
        const { error } = await supabase.from('committee_members').update(payload).eq('id', editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('committee_members').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committee'] });
      toast({ title: editItem ? 'Committee member updated' : 'Committee member added' });
      setIsFormOpen(false);
      setEditItem(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('committee_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committee'] });
      toast({ title: 'Committee member removed' });
      setDeleteItem(null);
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('committee_members').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committee'] });
      toast({ title: 'Status updated' });
    },
  });

  const filtered = committeeMembers?.filter(c =>
    (c.members as any)?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = committeeMembers?.filter(c => c.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Committee Management</h1>
          <p className="text-muted-foreground">Manage society committee members and their roles</p>
        </div>
        <Button onClick={() => { setEditItem(null); resetForm(); setIsFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Committee Member
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['chairman', 'secretary', 'treasurer', 'member'].map(role => {
          const count = committeeMembers?.filter(c => c.role === role && c.is_active).length || 0;
          return (
            <Card key={role}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <UserCog className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{roleLabels[role]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search committee members..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Committee Members</CardTitle>
          <CardDescription>{activeCount} active members</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No committee members</h3>
              <p className="text-muted-foreground">Add your first committee member</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Flat</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map(cm => {
                  const member = cm.members as any;
                  const flat = member?.flats;
                  return (
                    <TableRow key={cm.id}>
                      <TableCell className="font-medium">{member?.full_name || '-'}</TableCell>
                      <TableCell>{flat?.wing ? `${flat.wing}-` : ''}{flat?.flat_number || '-'}</TableCell>
                      <TableCell>
                        <Badge className={roleColors[cm.role] || ''}>{roleLabels[cm.role] || cm.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cm.term_start && cm.term_end
                          ? `${format(new Date(cm.term_start), 'MMM yyyy')} - ${format(new Date(cm.term_end), 'MMM yyyy')}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cm.is_active ? 'default' : 'secondary'}>
                          {cm.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditItem(cm); resetForm(cm); setIsFormOpen(true); }}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleActive.mutate({ id: cm.id, is_active: !cm.is_active })}>
                              {cm.is_active ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteItem(cm)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Committee Member' : 'Add Committee Member'}</DialogTitle>
            <DialogDescription>
              {editItem ? 'Update role and term details' : 'Select a society member to assign a committee role'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="member_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Member *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12"><SelectValue placeholder="Select a member" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {members?.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name} {m.flats ? `(${(m.flats as any).wing ? (m.flats as any).wing + '-' : ''}${(m.flats as any).flat_number})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Committee Role *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="chairman">Chairman</SelectItem>
                      <SelectItem value="secretary">Secretary</SelectItem>
                      <SelectItem value="treasurer">Treasurer</SelectItem>
                      <SelectItem value="member">Committee Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="term_start" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Term Start</FormLabel>
                    <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="term_end" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Term End</FormLabel>
                    <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="flex-1 h-12">Cancel</Button>
                <Button type="submit" className="flex-1 h-12" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Saving...' : editItem ? 'Update' : 'Add Member'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Committee Member</DialogTitle>
            <DialogDescription>Are you sure you want to remove this committee member?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
