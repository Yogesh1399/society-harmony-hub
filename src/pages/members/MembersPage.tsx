import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useAccess } from '@/hooks/useAccess';
import { Plus, Users, Search, Edit, Trash2, MoreHorizontal, Phone, Mail, Home, KeyRound, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MemberForm } from '@/components/members/MemberForm';
import { MembersBulkUpload } from '@/components/members/MembersBulkUpload';
import type { Database } from '@/integrations/supabase/db-types';

type Member = Database['public']['Tables']['members']['Row'] & {
  flats?: Database['public']['Tables']['flats']['Row'] | null;
};

export default function MembersPage() {
  const { currentSocietyId } = useAuthStore();
  const { can, isFullAccess } = useAccess();
  const canCreate = can('members', 'create');
  const canEdit   = can('members', 'edit');
  // Deleting a member removes their ledger history with them, so this
  // stays with the society administration, not the committee at large.
  const canDelete = isFullAccess;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('members')
        .select(`
          *,
          flats (*)
        `)
        .eq('society_id', currentSocietyId)
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({ title: 'Member deleted successfully' });
      setIsDeleteDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const createMemberAccount = async (member: Member) => {
    if (!currentSocietyId || !member.flat_id) return;
    try {
      const flatNumber = member.flats?.flat_number || 'unknown';
      const { data, error } = await supabase.functions.invoke('create-member-account', {
        body: {
          member_id: member.id,
          flat_number: flatNumber,
          society_id: currentSocietyId,
          full_name: member.full_name,
          email: member.email,
        },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({
        title: 'Login account created',
        description: `Email: ${data.email}${data.default_password ? ` | Default password: ${data.default_password}` : ' (account already existed)'}`,
      });
    } catch (err: any) {
      toast({ title: 'Error creating account', description: err.message, variant: 'destructive' });
    }
  };

  const filteredMembers = members?.filter(member =>
    member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.mobile?.includes(searchQuery) ||
    member.flats?.flat_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (member: Member) => {
    setSelectedMember(member);
    setIsFormOpen(true);
  };

  const handleDelete = (member: Member) => {
    setSelectedMember(member);
    setIsDeleteDialogOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedMember(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members Directory</h1>
          <p className="text-muted-foreground">
            {canEdit ? 'Manage flat owners and their details' : 'Flat owners and their contact details'}
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="touch-target">
              <Upload className="mr-2 h-4 w-4" />
              Bulk Upload
            </Button>
            <Button onClick={() => setIsFormOpen(true)} className="touch-target">
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, mobile, or flat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {members?.filter(m => m.is_active).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Home className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {members?.filter(m => m.flat_id).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">With Flats</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
          <CardDescription>
            {filteredMembers?.length || 0} members found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredMembers?.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No members found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search' : 'Add your first member to get started'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Flat</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers?.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.photo_url || undefined} />
                              <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{member.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{member.flats?.flat_number || '-'}</TableCell>
                        <TableCell>{member.mobile || '-'}</TableCell>
                        <TableCell>{member.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={member.is_active ? 'default' : 'secondary'}>
                            {member.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(canEdit || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit && (
                                <DropdownMenuItem onClick={() => handleEdit(member)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {isFullAccess && !member.user_id && member.flat_id && (
                                <DropdownMenuItem onClick={() => createMemberAccount(member)}>
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  Create Login
                                </DropdownMenuItem>
                              )}
                              {isFullAccess && member.user_id && (
                                <DropdownMenuItem disabled className="text-muted-foreground">
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  Login Active
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(member)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredMembers?.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={member.photo_url || undefined} />
                            <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{member.full_name}</p>
                            {member.flats && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Home className="h-3 w-3" />
                                {member.flats.flat_number}
                              </p>
                            )}
                          </div>
                        </div>
                        {(canEdit || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit && (
                              <DropdownMenuItem onClick={() => handleEdit(member)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {isFullAccess && !member.user_id && member.flat_id && (
                              <DropdownMenuItem onClick={() => createMemberAccount(member)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Create Login
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(member)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        )}
                      </div>
                      <div className="mt-3 space-y-1">
                        {member.mobile && (
                          <p className="text-sm flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {member.mobile}
                          </p>
                        )}
                        {member.email && (
                          <p className="text-sm flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {member.email}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMember ? 'Edit Member' : 'Add New Member'}</DialogTitle>
            <DialogDescription>
              {selectedMember ? 'Update member details' : 'Enter the details of the new member'}
            </DialogDescription>
          </DialogHeader>
          <MemberForm member={selectedMember} onClose={handleFormClose} />
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <MembersBulkUpload open={isBulkOpen} onOpenChange={setIsBulkOpen} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedMember?.full_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedMember && deleteMutation.mutate(selectedMember.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
