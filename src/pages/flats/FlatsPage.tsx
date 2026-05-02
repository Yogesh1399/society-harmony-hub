import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Building, Search, Edit, Trash2, MoreHorizontal, Users } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FlatForm } from '@/components/flats/FlatForm';
import type { Database } from '@/integrations/supabase/types';

type Flat = Database['public']['Tables']['flats']['Row'];
type FlatStatus = Database['public']['Enums']['flat_status'];

const statusColors: Record<FlatStatus, string> = {
  owner_occupied: 'bg-primary/10 text-primary',
  rented: 'bg-secondary text-secondary-foreground',
  vacant: 'bg-muted text-muted-foreground',
  available_for_tenant: 'bg-accent text-accent-foreground',
  tenant_occupied: 'bg-secondary text-secondary-foreground',
  under_transfer: 'bg-destructive/10 text-destructive',
  builder_owned: 'bg-muted text-muted-foreground',
  society_owned: 'bg-primary/10 text-primary',
};

const statusLabels: Record<FlatStatus, string> = {
  owner_occupied: 'Owner Occupied',
  rented: 'Rented',
  vacant: 'Vacant',
  available_for_tenant: 'Available for Tenant',
  tenant_occupied: 'Tenant Occupied',
  under_transfer: 'Under Transfer',
  builder_owned: 'Builder Owned',
  society_owned: 'Society Owned',
};

export default function FlatsPage() {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedFlat, setSelectedFlat] = useState<Flat | null>(null);

  const { data: flats, isLoading } = useQuery({
    queryKey: ['flats', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('flats')
        .select('*')
        .eq('society_id', currentSocietyId)
        .order('wing', { ascending: true })
        .order('flat_number', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (flatId: string) => {
      const { error } = await supabase.from('flats').delete().eq('id', flatId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flats'] });
      toast({ title: 'Flat deleted successfully' });
      setIsDeleteDialogOpen(false);
      setSelectedFlat(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const filteredFlats = flats?.filter(flat =>
    flat.flat_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flat.wing?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (flat: Flat) => {
    setSelectedFlat(flat);
    setIsFormOpen(true);
  };

  const handleDelete = (flat: Flat) => {
    setSelectedFlat(flat);
    setIsDeleteDialogOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedFlat(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flats Management</h1>
          <p className="text-muted-foreground">Manage all flats in your society</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="touch-target">
          <Plus className="mr-2 h-4 w-4" />
          Add Flat
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by flat number or wing..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{flats?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Flats</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Users className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {flats?.filter(f => f.status === 'owner_occupied').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Owner Occupied</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <Users className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {flats?.filter(f => f.status === 'rented').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Rented</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Building className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {flats?.filter(f => f.status === 'vacant').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Vacant</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flats List */}
      <Card>
        <CardHeader>
          <CardTitle>All Flats</CardTitle>
          <CardDescription>
            {filteredFlats?.length || 0} flats found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredFlats?.length === 0 ? (
            <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No flats found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search' : 'Add your first flat to get started'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flat No.</TableHead>
                      <TableHead>Wing</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Area (sq.ft)</TableHead>
                      <TableHead>Parking</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFlats?.map((flat) => (
                      <TableRow key={flat.id}>
                        <TableCell className="font-medium">{flat.flat_number}</TableCell>
                        <TableCell>{flat.wing || '-'}</TableCell>
                        <TableCell>{flat.floor ?? '-'}</TableCell>
                        <TableCell>{flat.area_sqft ? Number(flat.area_sqft).toLocaleString('en-IN') : '-'}</TableCell>
                        <TableCell>{flat.parking_slots || 0}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[flat.status || 'vacant']}>
                            {statusLabels[flat.status || 'vacant']}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(flat)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(flat)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredFlats?.map((flat) => (
                  <Card key={flat.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-lg">{flat.flat_number}</span>
                            {flat.wing && (
                              <span className="text-muted-foreground">• Wing {flat.wing}</span>
                            )}
                          </div>
                          <Badge className={statusColors[flat.status || 'vacant']}>
                            {statusLabels[flat.status || 'vacant']}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(flat)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(flat)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Floor</p>
                          <p className="font-medium">{flat.floor ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Area</p>
                          <p className="font-medium">{flat.area_sqft ? `${flat.area_sqft} sq.ft` : '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Parking</p>
                          <p className="font-medium">{flat.parking_slots || 0}</p>
                        </div>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedFlat ? 'Edit Flat' : 'Add New Flat'}</DialogTitle>
            <DialogDescription>
              {selectedFlat ? 'Update flat details' : 'Enter the details of the new flat'}
            </DialogDescription>
          </DialogHeader>
          <FlatForm flat={selectedFlat} onClose={handleFormClose} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Flat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete flat {selectedFlat?.flat_number}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedFlat && deleteMutation.mutate(selectedFlat.id)}
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
