import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import {
  Building, Plus, ArrowLeft, Search, MoreHorizontal, Trash2, Edit, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

const societySchema = z.object({
  name: z.string().min(1, 'Society name is required'),
  registration_no: z.string().optional(),
  registration_date: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  pan_number: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account: z.string().optional(),
  bank_ifsc: z.string().optional(),
  financial_year: z.string().default('2024-25'),
  package_type: z.enum(['basic', 'standard', 'professional'] as const).default('basic'),
  admin_email: z.string().email('Valid email required').optional().or(z.literal('')),
});

type SocietyFormValues = z.infer<typeof societySchema>;

export default function SocietyRegistration() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: societies, isLoading } = useQuery({
    queryKey: ['all_societies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('societies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const form = useForm<SocietyFormValues>({
    resolver: zodResolver(societySchema),
    defaultValues: {
      name: '',
      registration_no: '',
      registration_date: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      pan_number: '',
      bank_name: '',
      bank_account: '',
      bank_ifsc: '',
      financial_year: '2024-25',
      package_type: 'basic',
      admin_email: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: SocietyFormValues) => {
      const { data, error } = await supabase
        .from('societies')
        .insert({
          name: values.name,
          registration_no: values.registration_no || null,
          registration_date: values.registration_date || null,
          address: values.address || null,
          city: values.city || null,
          state: values.state || null,
          pincode: values.pincode || null,
          pan_number: values.pan_number || null,
          bank_name: values.bank_name || null,
          bank_account: values.bank_account || null,
          bank_ifsc: values.bank_ifsc || null,
          financial_year: values.financial_year,
          package_type: values.package_type as Database['public']['Enums']['package_type'],
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;

      // Note: feature_settings, income_heads, expense_heads, and receipt_series
      // are auto-created by the handle_new_society database trigger

      // Assign society admin if email provided
      if (values.admin_email) {
        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke('assign-society-admin', {
            body: { admin_email: values.admin_email, society_id: data.id },
          });
          if (fnError) console.error('Error assigning admin:', fnError);
        } catch (e) {
          console.error('Error calling assign-society-admin:', e);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_societies'] });
      toast({ title: 'Society registered successfully!' });
      setIsFormOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('societies')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_societies'] });
      toast({ title: 'Society status updated' });
    },
  });

  const filtered = societies?.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.registration_no?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/super-admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Society Management</h1>
            <p className="text-muted-foreground">Register and manage societies</p>
          </div>
        </div>
        <Button onClick={() => setIsFormOpen(true)} size="lg">
          <Plus className="mr-2 h-4 w-4" /> Register New Society
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, city, or registration number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Societies List */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Societies ({filtered?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No societies found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try adjusting your search' : 'Register your first society'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Society Name</TableHead>
                    <TableHead>Registration No.</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered?.map((society) => (
                    <TableRow key={society.id}>
                      <TableCell className="font-semibold">{society.name}</TableCell>
                      <TableCell>{society.registration_no || '-'}</TableCell>
                      <TableCell>{society.city || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {society.package_type || 'basic'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={society.is_active ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}>
                          {society.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {society.created_at ? format(new Date(society.created_at), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => toggleStatusMutation.mutate({
                                id: society.id,
                                is_active: !society.is_active,
                              })}
                            >
                              {society.is_active ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Society</DialogTitle>
            <DialogDescription>Fill in the society details to register</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground border-b pb-2">Basic Information</h3>
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Society Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Green Valley CHS" className="h-12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="registration_no" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number</FormLabel>
                      <FormControl><Input placeholder="Society registration no." className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="registration_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Date</FormLabel>
                      <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground border-b pb-2">Address</h3>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Address</FormLabel>
                    <FormControl><Textarea placeholder="Society address" rows={2} {...field} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input placeholder="City" className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input placeholder="State" className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="pincode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl><Input placeholder="Pincode" className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Financial */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground border-b pb-2">Financial Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="pan_number" render={({ field }) => (
                    <FormItem>
                      <FormLabel>PAN Number</FormLabel>
                      <FormControl><Input placeholder="Society PAN" className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="financial_year" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Financial Year</FormLabel>
                      <FormControl><Input placeholder="e.g. 2024-25" className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="bank_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl><Input placeholder="Bank name" className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="bank_account" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl><Input placeholder="Account no." className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="bank_ifsc" render={({ field }) => (
                    <FormItem>
                      <FormLabel>IFSC Code</FormLabel>
                      <FormControl><Input placeholder="IFSC" className="h-12" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Package & Admin */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground border-b pb-2">Subscription & Admin</h3>
                <FormField control={form.control} name="package_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="basic">Basic - Core features</SelectItem>
                        <SelectItem value="standard">Standard - Core + Advanced</SelectItem>
                        <SelectItem value="professional">Professional - All features</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="admin_email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Society Admin Email</FormLabel>
                    <FormControl><Input placeholder="admin@example.com (must be a registered user)" className="h-12" {...field} /></FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">This user will be assigned as society_admin. Leave blank to skip.</p>
                  </FormItem>
                )} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="flex-1 h-12">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 h-12" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Registering...' : 'Register Society'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
