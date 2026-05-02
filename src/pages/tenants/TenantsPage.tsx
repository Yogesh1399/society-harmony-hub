import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { Plus, UserCheck, Search, Eye, Trash2, MoreHorizontal, Edit, LogOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { TenantForm } from '@/components/tenants/TenantForm';
import { TenantDetailDialog } from '@/components/tenants/TenantDetailDialog';

export default function TenantsPage() {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<any>(null);
  const [viewTenant, setViewTenant] = useState<any>(null);
  const [reactivateTenant, setReactivateTenant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('active');

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('tenants')
        .select('*, flats(*)')
        .eq('society_id', currentSocietyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tenants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({ title: 'Tenant removed' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const markLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tenants').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({ title: 'Tenant marked as left', description: 'Tenant has been moved to inactive list.' });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async ({ id, validity_from, validity_to }: { id: string; validity_from: string; validity_to: string }) => {
      const { error } = await supabase.from('tenants').update({
        is_active: true,
        validity_from,
        validity_to,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({ title: 'Tenant reactivated' });
      setReactivateTenant(null);
    },
  });

  const activeTenants = tenants?.filter(t => t.is_active) || [];
  const inactiveTenants = tenants?.filter(t => !t.is_active) || [];

  const currentList = activeTab === 'active' ? activeTenants : inactiveTenants;

  const filtered = currentList.filter(t =>
    t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.mobile?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.flats?.flat_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTenantRow = (tenant: any) => (
    <TableRow key={tenant.id}>
      <TableCell className="font-medium">{tenant.full_name}</TableCell>
      <TableCell>{tenant.flats?.wing ? `${tenant.flats.wing}-` : ''}{tenant.flats?.flat_number || '-'}</TableCell>
      <TableCell>{tenant.mobile || '-'}</TableCell>
      <TableCell>
        {tenant.validity_from && tenant.validity_to
          ? `${format(new Date(tenant.validity_from), 'dd/MM/yy')} - ${format(new Date(tenant.validity_to), 'dd/MM/yy')}`
          : '-'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
            {tenant.is_active ? 'Active' : 'Left'}
          </Badge>
          {tenant.verified_at ? (
            <Badge variant="outline" className="text-success border-success text-xs">✓ Verified</Badge>
          ) : (
            <Badge variant="outline" className="text-destructive border-destructive text-xs">Unverified</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewTenant(tenant)}><Eye className="mr-2 h-4 w-4" />View</DropdownMenuItem>
            {tenant.is_active && (
              <>
                <DropdownMenuItem onClick={() => { setEditTenant(tenant); setIsFormOpen(true); }}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => markLeaveMutation.mutate(tenant.id)}>
                  <LogOut className="mr-2 h-4 w-4" />Mark as Left
                </DropdownMenuItem>
              </>
            )}
            {!tenant.is_active && (
              <DropdownMenuItem onClick={() => setReactivateTenant(tenant)}>
                <RotateCcw className="mr-2 h-4 w-4" />Reactivate
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => deleteMutation.mutate(tenant.id)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tenant Management</h1>
          <p className="text-muted-foreground">Manage tenants across society flats</p>
        </div>
        <Button onClick={() => { setEditTenant(null); setIsFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Tenant
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('active')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeTenants.length}</p>
                <p className="text-sm text-muted-foreground">Active Tenants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('inactive')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <UserCheck className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveTenants.length}</p>
                <p className="text-sm text-muted-foreground">Left / Inactive</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <UserCheck className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{tenants?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total (All Time)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search tenants..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenants Register</CardTitle>
              <CardDescription>{filtered.length} tenants found</CardDescription>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="active">Active ({activeTenants.length})</TabsTrigger>
                <TabsTrigger value="inactive">Inactive ({inactiveTenants.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No {activeTab} tenants found</h3>
              <p className="text-muted-foreground">{searchQuery ? 'Try adjusting your search' : activeTab === 'active' ? 'Add your first tenant' : 'No inactive tenants'}</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Flat</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{filtered.map(renderTenantRow)}</TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3">
                {filtered.map((tenant) => (
                  <Card key={tenant.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewTenant(tenant)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{tenant.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {tenant.flats?.wing ? `${tenant.flats.wing}-` : ''}{tenant.flats?.flat_number || 'No flat'}
                          </p>
                          <p className="text-xs text-muted-foreground">{tenant.mobile}</p>
                        </div>
                        <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
                          {tenant.is_active ? 'Active' : 'Left'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTenant ? 'Edit Tenant' : 'Add Tenant'}</DialogTitle>
            <DialogDescription>
              {editTenant ? 'Update tenant details' : 'Add a new tenant to a flat'}
            </DialogDescription>
          </DialogHeader>
          <TenantForm tenant={editTenant} onClose={() => { setIsFormOpen(false); setEditTenant(null); }} />
        </DialogContent>
      </Dialog>

      {/* Reactivate Dialog */}
      <ReactivateDialog
        tenant={reactivateTenant}
        open={!!reactivateTenant}
        onOpenChange={(open) => !open && setReactivateTenant(null)}
        onReactivate={(data) => reactivateMutation.mutate(data)}
        isPending={reactivateMutation.isPending}
      />

      {/* Detail Dialog */}
      <TenantDetailDialog tenant={viewTenant} open={!!viewTenant} onOpenChange={(open) => !open && setViewTenant(null)} />
    </div>
  );
}

function ReactivateDialog({ tenant, open, onOpenChange, onReactivate, isPending }: {
  tenant: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReactivate: (data: { id: string; validity_from: string; validity_to: string }) => void;
  isPending: boolean;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reactivate Tenant</DialogTitle>
          <DialogDescription>
            Reactivate <strong>{tenant.full_name}</strong> with previous details. Set new tenant period.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border p-3 space-y-1 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {tenant.full_name}</p>
            <p><span className="text-muted-foreground">Mobile:</span> {tenant.mobile || '-'}</p>
            <p><span className="text-muted-foreground">Email:</span> {tenant.email || '-'}</p>
            <p><span className="text-muted-foreground">Flat:</span> {tenant.flats?.wing ? `${tenant.flats.wing}-` : ''}{tenant.flats?.flat_number || '-'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">New Period From *</label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 h-12" />
            </div>
            <div>
              <label className="text-sm font-medium">New Period To *</label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 h-12" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1 h-12" disabled={!from || !to || isPending} onClick={() => onReactivate({ id: tenant.id, validity_from: from, validity_to: to })}>
              {isPending ? 'Reactivating...' : 'Reactivate Tenant'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
