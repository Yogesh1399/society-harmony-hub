import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import {
  Shield, Plus, Edit, Trash2, Users, ChevronRight, UserPlus, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Alert, AlertDescription,
} from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

const ALL_MODULES = [
  'dashboard', 'flats', 'members', 'tenants', 'committee', 'income', 'expenses',
  'reports', 'notices', 'complaints', 'documents', 'notifications', 'settings',
  'maintenance', 'profile', 'family_members',
];
const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'] as const;

export default function AdminControllerPage() {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [bulkUserIds, setBulkUserIds] = useState<string[]>([]);

  // Fetch permission groups
  const { data: groups, isLoading } = useQuery({
    queryKey: ['permission-groups', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('permission_groups').select('*')
        .eq('society_id', currentSocietyId).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Fetch permissions for selected group
  const { data: groupPermissions } = useQuery({
    queryKey: ['group-permissions', selectedGroup?.id],
    queryFn: async () => {
      if (!selectedGroup?.id) return [];
      const { data, error } = await supabase
        .from('group_permissions').select('*').eq('group_id', selectedGroup.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedGroup?.id,
  });

  // Fetch users in selected group — join via members table for names
  const { data: groupUsers, isLoading: groupUsersLoading } = useQuery({
    queryKey: ['group-users', selectedGroup?.id],
    queryFn: async () => {
      if (!selectedGroup?.id) return [];
      const { data, error } = await supabase
        .from('user_group_assignments')
        .select('id, user_id, assigned_at, group_id')
        .eq('group_id', selectedGroup.id);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch member info for each user_id
      const userIds = data.map((d: any) => d.user_id);
      const { data: members } = await supabase
        .from('members')
        .select('user_id, full_name, email, mobile, flats(flat_number, wing)')
        .eq('society_id', currentSocietyId!)
        .in('user_id', userIds);

      return data.map((assignment: any) => {
        const member = members?.find((m: any) => m.user_id === assignment.user_id);
        return { ...assignment, member };
      });
    },
    enabled: !!selectedGroup?.id && !!currentSocietyId,
  });

  // Fetch all members for the society (for assignment)
  const { data: allMembers } = useQuery({
    queryKey: ['all-members-for-assign', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, email, user_id, flat_id, flats(flat_number, wing)')
        .eq('society_id', currentSocietyId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Fetch ALL group assignments for this society (to detect overlaps)
  const { data: allAssignments } = useQuery({
    queryKey: ['all-group-assignments', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('user_group_assignments')
        .select('user_id, group_id, permission_groups(name)')
        .eq('society_id', currentSocietyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Compute overlapping users (assigned to 2+ groups)
  const overlappingUsers = (() => {
    if (!allAssignments || !allMembers) return [];
    const userGroupMap: Record<string, string[]> = {};
    for (const a of allAssignments) {
      if (!userGroupMap[a.user_id]) userGroupMap[a.user_id] = [];
      userGroupMap[a.user_id].push((a as any).permission_groups?.name || a.group_id);
    }
    return Object.entries(userGroupMap)
      .filter(([, groups]) => groups.length > 1)
      .map(([userId, groups]) => {
        const member = allMembers.find(m => m.user_id === userId);
        return { userId, groups, member };
      });
  })();

  // CRUD mutations
  const saveGroupMutation = useMutation({
    mutationFn: async () => {
      if (!currentSocietyId) throw new Error('No society');
      if (editGroup) {
        const { error } = await supabase.from('permission_groups')
          .update({ name: groupForm.name, description: groupForm.description }).eq('id', editGroup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('permission_groups')
          .insert({ society_id: currentSocietyId, name: groupForm.name, description: groupForm.description });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-groups'] });
      toast({ title: editGroup ? 'Group updated' : 'Group created' });
      setIsGroupFormOpen(false);
      setEditGroup(null);
      setGroupForm({ name: '', description: '' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('permission_groups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-groups'] });
      toast({ title: 'Group deleted' });
      if (selectedGroup) setSelectedGroup(null);
    },
  });

  const togglePermissionMutation = useMutation({
    mutationFn: async ({ module, action, enabled }: { module: string; action: string; enabled: boolean }) => {
      if (!selectedGroup) return;
      const existing = groupPermissions?.find(p => p.module === module);
      if (existing) {
        const { error } = await supabase.from('group_permissions')
          .update({ [`can_${action}`]: enabled }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('group_permissions')
          .insert({ group_id: selectedGroup.id, module, [`can_${action}`]: enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-permissions'] }),
  });

  const assignUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!selectedGroup || !currentSocietyId) return;
      const { error } = await supabase.from('user_group_assignments')
        .insert({ user_id: userId, group_id: selectedGroup.id, society_id: currentSocietyId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-group-assignments'] });
      toast({ title: 'User assigned to group' });
      setIsAssignDialogOpen(false);
      setSearchQuery('');
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const removeUserMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from('user_group_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-group-assignments'] });
      toast({ title: 'User removed from group' });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      if (!bulkGroupId || !currentSocietyId || bulkUserIds.length === 0) throw new Error('Select group and users');
      const inserts = bulkUserIds.map(uid => ({ user_id: uid, group_id: bulkGroupId, society_id: currentSocietyId }));
      const { error } = await supabase.from('user_group_assignments')
        .upsert(inserts, { onConflict: 'user_id,group_id,society_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-users'] });
      queryClient.invalidateQueries({ queryKey: ['all-group-assignments'] });
      toast({ title: `${bulkUserIds.length} users assigned` });
      setIsBulkAssignOpen(false);
      setBulkUserIds([]);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const getPermValue = (module: string, action: string): boolean => {
    const perm = groupPermissions?.find(p => p.module === module);
    if (!perm) return false;
    return (perm as any)[`can_${action}`] ?? false;
  };

  // Members not yet assigned to current group (for assign dialog)
  const availableToAssign = allMembers?.filter(m =>
    m.user_id &&
    m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !groupUsers?.some((gu: any) => gu.user_id === m.user_id)
  ) || [];

  const getUserOverlapGroups = (userId: string): string[] => {
    const others = allAssignments?.filter(a => a.user_id === userId && a.group_id !== selectedGroup?.id) || [];
    return others.map((a: any) => a.permission_groups?.name || a.group_id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6" /> Admin Controller
          </h1>
          <p className="text-muted-foreground">Manage user groups, permissions, and role assignments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkAssignOpen(true)}>
            <Users className="mr-2 h-4 w-4" /> Bulk Assign
          </Button>
          <Button onClick={() => { setEditGroup(null); setGroupForm({ name: '', description: '' }); setIsGroupFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Create Group
          </Button>
        </div>
      </div>

      {/* Overlap Warning Banner */}
      {overlappingUsers.length > 0 && (
        <Alert className="border-amber-400 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>{overlappingUsers.length} user(s) are assigned to multiple groups</strong> — they will have combined permissions of all their groups.
            <div className="mt-2 space-y-1">
              {overlappingUsers.map(({ userId, groups, member }) => (
                <div key={userId} className="text-sm">
                  <span className="font-medium">{member?.full_name || userId}</span>
                  <span className="text-amber-600"> → </span>
                  {groups.map((g, i) => (
                    <Badge key={i} variant="outline" className="mr-1 text-xs border-amber-400">{g}</Badge>
                  ))}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Groups List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">User Groups</CardTitle>
            <CardDescription>{groups?.length || 0} groups</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading groups...</p>
            ) : groups?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No groups yet. Create one to get started.</p>
            ) : groups?.map(group => (
              <div
                key={group.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedGroup?.id === group.id ? 'bg-primary/10 border-primary' : 'hover:bg-accent'
                }`}
                onClick={() => setSelectedGroup(group)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{group.name}</p>
                    {group.is_system && <Badge variant="secondary" className="text-xs">System</Badge>}
                  </div>
                  {group.description && <p className="text-xs text-muted-foreground truncate">{group.description}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Group Detail */}
        <Card className="lg:col-span-2">
          {selectedGroup ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedGroup.name}
                      {selectedGroup.is_system && <Badge variant="secondary">System</Badge>}
                    </CardTitle>
                    <CardDescription>{selectedGroup.description || 'No description'}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditGroup(selectedGroup);
                      setGroupForm({ name: selectedGroup.name, description: selectedGroup.description || '' });
                      setIsGroupFormOpen(true);
                    }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!selectedGroup.is_system && (
                      <Button size="sm" variant="destructive" onClick={() => deleteGroupMutation.mutate(selectedGroup.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="users">
                  <TabsList>
                    <TabsTrigger value="users">
                      Users ({groupUsers?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  </TabsList>

                  {/* USERS TAB */}
                  <TabsContent value="users" className="mt-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {groupUsers?.length || 0} user(s) in this group
                      </p>
                      <Button size="sm" onClick={() => { setSearchQuery(''); setIsAssignDialogOpen(true); }}>
                        <UserPlus className="mr-2 h-4 w-4" /> Assign User
                      </Button>
                    </div>

                    {groupUsersLoading ? (
                      <p className="text-center py-6 text-muted-foreground">Loading users...</p>
                    ) : groupUsers && groupUsers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Flat</TableHead>
                            <TableHead>Other Groups</TableHead>
                            <TableHead className="text-right">Remove</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupUsers.map((gu: any) => {
                            const otherGroups = getUserOverlapGroups(gu.user_id);
                            return (
                              <TableRow key={gu.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{gu.member?.full_name || `User: ${gu.user_id.slice(0, 8)}...`}</p>
                                    <p className="text-xs text-muted-foreground">{gu.member?.email || ''}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {gu.member?.flats
                                    ? `${(gu.member.flats as any)?.wing ? (gu.member.flats as any).wing + '-' : ''}${(gu.member.flats as any)?.flat_number}`
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  {otherGroups.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {otherGroups.map((g, i) => (
                                        <Badge key={i} variant="outline" className="text-xs border-amber-400 text-amber-700">
                                          {g}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">None</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => removeUserMutation.mutate(gu.id)}
                                    disabled={removeUserMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <Users className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
                        <p className="text-muted-foreground font-medium">No users in this group</p>
                        <p className="text-sm text-muted-foreground mt-1">Click "Assign User" to add members</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* PERMISSIONS TAB */}
                  <TabsContent value="permissions" className="mt-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Module</TableHead>
                            {ALL_ACTIONS.map(a => (
                              <TableHead key={a} className="text-center capitalize w-[80px]">{a}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ALL_MODULES.map(module => (
                            <TableRow key={module}>
                              <TableCell className="font-medium capitalize">{module.replace('_', ' ')}</TableCell>
                              {ALL_ACTIONS.map(action => (
                                <TableCell key={action} className="text-center">
                                  <Checkbox
                                    checked={getPermValue(module, action)}
                                    onCheckedChange={(checked) =>
                                      togglePermissionMutation.mutate({ module, action, enabled: !!checked })
                                    }
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Shield className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Select a Group</h3>
                <p className="text-muted-foreground">Click on a group to manage its permissions and users</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Create/Edit Group Dialog */}
      <Dialog open={isGroupFormOpen} onOpenChange={setIsGroupFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editGroup ? 'Edit Group' : 'Create Group'}</DialogTitle>
            <DialogDescription>Define a user group with permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group Name *</label>
              <Input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} className="h-12 mt-1" placeholder="e.g., Staff" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="Group description" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsGroupFormOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveGroupMutation.mutate()} disabled={!groupForm.name || saveGroupMutation.isPending}>
                {saveGroupMutation.isPending ? 'Saving...' : editGroup ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={(open) => { setIsAssignDialogOpen(open); if (!open) setSearchQuery(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign User to "{selectedGroup?.name}"</DialogTitle>
            <DialogDescription>Only members with login accounts can be assigned</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Search by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <div className="max-h-[320px] overflow-y-auto space-y-2">
              {availableToAssign.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">
                  {searchQuery ? 'No matching members found' : 'All eligible members are already assigned'}
                </p>
              ) : availableToAssign.map(m => {
                const inOtherGroups = getUserOverlapGroups(m.user_id!);
                return (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded border hover:bg-accent">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(m.flats as any)?.wing ? `${(m.flats as any).wing}-` : ''}{(m.flats as any)?.flat_number}
                        {inOtherGroups.length > 0 && (
                          <span className="ml-2 text-amber-600">⚠ also in: {inOtherGroups.join(', ')}</span>
                        )}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="ml-2 flex-shrink-0" onClick={() => assignUserMutation.mutate(m.user_id!)} disabled={assignUserMutation.isPending}>
                      Assign
                    </Button>
                  </div>
                );
              })}
            </div>
            {/* Show members without login separately */}
            {allMembers?.filter(m => !m.user_id && m.full_name.toLowerCase().includes(searchQuery.toLowerCase())).length! > 0 && (
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground mb-1">Members without login (create account first):</p>
                {allMembers?.filter(m => !m.user_id && m.full_name.toLowerCase().includes(searchQuery.toLowerCase())).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 opacity-50">
                    <p className="text-sm">{m.full_name}</p>
                    <span className="text-xs text-muted-foreground">No login</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Role Assignment</DialogTitle>
            <DialogDescription>Assign multiple users to a group at once</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Group</label>
              <Select value={bulkGroupId} onValueChange={setBulkGroupId}>
                <SelectTrigger className="h-12 mt-1"><SelectValue placeholder="Choose group" /></SelectTrigger>
                <SelectContent>
                  {groups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Select Members with Login</label>
              <div className="max-h-[250px] overflow-y-auto space-y-1 mt-2 border rounded-lg p-2">
                {allMembers?.filter(m => m.user_id).map(m => {
                  const inGroups = allAssignments?.filter(a => a.user_id === m.user_id).map((a: any) => a.permission_groups?.name) || [];
                  return (
                    <label key={m.id} className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer">
                      <Checkbox
                        checked={bulkUserIds.includes(m.user_id!)}
                        onCheckedChange={(checked) => {
                          if (checked) setBulkUserIds(prev => [...prev, m.user_id!]);
                          else setBulkUserIds(prev => prev.filter(id => id !== m.user_id));
                        }}
                      />
                      <span className="text-sm flex-1">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground">{(m.flats as any)?.flat_number}</span>
                      {inGroups.length > 0 && (
                        <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">
                          {inGroups.join(', ')}
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsBulkAssignOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => bulkAssignMutation.mutate()} disabled={!bulkGroupId || bulkUserIds.length === 0 || bulkAssignMutation.isPending}>
                {bulkAssignMutation.isPending ? 'Assigning...' : `Assign ${bulkUserIds.length} Users`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
