import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import {
  Users, Search, Shield, Plus, Trash2, MoreHorizontal, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  society_admin: 'Society Admin',
  committee_member: 'Committee Member',
  flat_owner: 'Flat Owner',
  tenant: 'Tenant',
  auditor: 'Auditor',
};

const roleBadgeClass: Record<string, string> = {
  super_admin: 'bg-primary/10 text-primary',
  society_admin: 'bg-accent text-accent-foreground',
  committee_member: 'bg-secondary text-secondary-foreground',
  flat_owner: 'bg-muted text-muted-foreground',
  tenant: 'bg-muted text-muted-foreground',
  auditor: 'bg-muted text-muted-foreground',
};

export default function UserManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState('society_admin');
  const [assignSocietyId, setAssignSocietyId] = useState('');

  const { data: profiles } = useQuery({
    queryKey: ['all_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allRoles } = useQuery({
    queryKey: ['all_user_roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*, societies(name)');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: societies } = useQuery({
    queryKey: ['all_societies_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('societies').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: async () => {
      // Find user by email
      const profile = profiles?.find(p => p.email === assignEmail);
      if (!profile) throw new Error('User not found with this email');

      const { error } = await supabase.from('user_roles').insert({
        user_id: profile.id,
        role: assignRole as any,
        society_id: assignRole === 'super_admin' ? null : assignSocietyId || null,
      });
      if (error) throw error;

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        action: 'ASSIGN_ROLE',
        table_name: 'user_roles',
        society_id: assignSocietyId || null,
        new_values: { email: assignEmail, role: assignRole, society_id: assignSocietyId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_roles'] });
      toast({ title: 'Role assigned successfully' });
      setIsAssignOpen(false);
      setAssignEmail('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const revokeRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user?.id || null,
        action: 'REVOKE_ROLE',
        table_name: 'user_roles',
        record_id: roleId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_user_roles'] });
      toast({ title: 'Role revoked' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getUserRoles = (userId: string) =>
    allRoles?.filter(r => r.user_id === userId) || [];

  const filtered = profiles?.filter(p =>
    p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/super-admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">Manage users and their roles across societies</p>
          </div>
        </div>
        <Button onClick={() => setIsAssignOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Assign Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{profiles?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg"><Shield className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{allRoles?.filter(r => r.role === 'society_admin').length || 0}</p>
                <p className="text-sm text-muted-foreground">Society Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg"><Shield className="h-5 w-5 text-secondary-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{allRoles?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users ({filtered?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered?.map(profile => {
                  const roles = getUserRoles(profile.id);
                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.full_name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {roles.length === 0 ? (
                            <Badge variant="outline" className="text-xs">No Role</Badge>
                          ) : roles.map(r => (
                            <div key={r.id} className="flex items-center gap-1">
                              <Badge className={`text-xs ${roleBadgeClass[r.role] || ''}`}>
                                {roleLabels[r.role] || r.role}
                                {(r as any).societies?.name ? ` (${(r as any).societies.name})` : ''}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => revokeRoleMutation.mutate(r.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {profile.created_at ? format(new Date(profile.created_at), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={profile.is_active ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}>
                          {profile.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assign Role Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>Assign a role to a registered user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">User Email *</label>
              <Input
                placeholder="user@example.com"
                value={assignEmail}
                onChange={(e) => setAssignEmail(e.target.value)}
                className="h-12 mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role *</label>
              <Select value={assignRole} onValueChange={setAssignRole}>
                <SelectTrigger className="h-12 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="society_admin">Society Admin</SelectItem>
                  <SelectItem value="committee_member">Committee Member</SelectItem>
                  <SelectItem value="flat_owner">Flat Owner</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignRole !== 'super_admin' && (
              <div>
                <label className="text-sm font-medium">Society</label>
                <Select value={assignSocietyId} onValueChange={setAssignSocietyId}>
                  <SelectTrigger className="h-12 mt-1"><SelectValue placeholder="Select society" /></SelectTrigger>
                  <SelectContent>
                    {societies?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsAssignOpen(false)} className="flex-1 h-12">Cancel</Button>
              <Button onClick={() => assignRoleMutation.mutate()} disabled={!assignEmail || assignRoleMutation.isPending} className="flex-1 h-12">
                {assignRoleMutation.isPending ? 'Assigning...' : 'Assign Role'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
