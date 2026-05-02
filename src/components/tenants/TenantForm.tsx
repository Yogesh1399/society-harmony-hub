import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, AlertTriangle } from 'lucide-react';

const tenantSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  flat_id: z.string().min(1, 'Flat is required'),
  aadhar_masked: z.string().optional(),
  native_address: z.string().optional(),
  validity_from: z.string().min(1, 'Tenant period start is required'),
  validity_to: z.string().min(1, 'Tenant period end is required'),
  rent_amount: z.string().optional(),
  period_change_reason: z.string().optional(),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

interface Props {
  tenant?: any;
  onClose: () => void;
}

export function TenantForm({ tenant, onClose }: Props) {
  const { currentSocietyId, user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rentAgreementFile, setRentAgreementFile] = useState<File | null>(null);
  const [policeVerificationFile, setPoliceVerificationFile] = useState<File | null>(null);

  // Fetch flats that have an owner (member assigned) and status allows tenant
  const { data: flats } = useQuery({
    queryKey: ['flats-with-owners', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data: flatsData } = await supabase
        .from('flats')
        .select('*, members(full_name, user_id)')
        .eq('society_id', currentSocietyId)
        .order('flat_number');
      // Only show flats with owners AND status allows tenant assignment
      const allowedStatuses = ['rented', 'available_for_tenant', 'vacant'];
      return (flatsData || []).filter(flat =>
        flat.members && flat.members.length > 0 &&
        allowedStatuses.includes(flat.status || 'vacant')
      );
    },
    enabled: !!currentSocietyId,
  });

  // Fetch active tenants to check for duplicates
  const { data: activeTenants } = useQuery({
    queryKey: ['active-tenants', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('tenants')
        .select('id, flat_id')
        .eq('society_id', currentSocietyId)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      full_name: tenant?.full_name || '',
      mobile: tenant?.mobile || '',
      email: tenant?.email || '',
      flat_id: tenant?.flat_id || '',
      aadhar_masked: tenant?.aadhar_masked || '',
      native_address: tenant?.native_address || '',
      validity_from: tenant?.validity_from || '',
      validity_to: tenant?.validity_to || '',
      rent_amount: tenant?.rent_amount?.toString() || '',
      period_change_reason: '',
    },
  });

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from('tenant-documents')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('tenant-documents').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const mutation = useMutation({
    mutationFn: async (values: TenantFormValues) => {
      if (!currentSocietyId) throw new Error('No society selected');

      // Check if flat already has an active tenant (skip for editing same tenant)
      const existingActive = activeTenants?.find(t => t.flat_id === values.flat_id && t.id !== tenant?.id);
      if (existingActive) {
        throw new Error('This flat already has an active tenant. Mark the existing tenant as "Left" before adding a new one.');
      }

      let rentAgreementUrl = tenant?.rent_agreement_url || null;
      let policeVerificationUrl = tenant?.police_verification_url || null;

      const tenantId = tenant?.id || crypto.randomUUID();

      if (rentAgreementFile) {
        rentAgreementUrl = await uploadFile(rentAgreementFile, `${currentSocietyId}/${tenantId}/rent-agreement-${Date.now()}`);
      }
      if (policeVerificationFile) {
        policeVerificationUrl = await uploadFile(policeVerificationFile, `${currentSocietyId}/${tenantId}/police-verification-${Date.now()}`);
      }

      const payload = {
        society_id: currentSocietyId,
        full_name: values.full_name,
        mobile: values.mobile || null,
        email: values.email || null,
        flat_id: values.flat_id,
        aadhar_masked: values.aadhar_masked || null,
        native_address: values.native_address || null,
        validity_from: values.validity_from,
        validity_to: values.validity_to,
        rent_amount: values.rent_amount ? parseFloat(values.rent_amount) : 0,
        rent_agreement_url: rentAgreementUrl,
        police_verification_url: policeVerificationUrl,
      };

      if (tenant) {
        if (tenant.validity_from !== values.validity_from || tenant.validity_to !== values.validity_to) {
          if (!values.period_change_reason?.trim()) {
            throw new Error('Reason is mandatory when changing tenant period');
          }
          await supabase.from('tenant_period_history' as any).insert({
            tenant_id: tenant.id,
            validity_from: tenant.validity_from,
            validity_to: tenant.validity_to,
            reason: values.period_change_reason,
            changed_by: user?.id,
          });
        }
        const { error } = await supabase.from('tenants').update(payload).eq('id', tenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenants').insert({ ...payload, id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['active-tenants'] });
      toast({ title: tenant ? 'Tenant updated' : 'Tenant added' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const selectedFlatId = form.watch('flat_id');
  const selectedFlat = flats?.find(f => f.id === selectedFlatId);
  const ownerName = selectedFlat?.members?.[0]?.full_name;
  const flatHasActiveTenant = activeTenants?.some(t => t.flat_id === selectedFlatId && t.id !== tenant?.id);

  const isPeriodChanged = tenant && (
    form.watch('validity_from') !== tenant.validity_from ||
    form.watch('validity_to') !== tenant.validity_to
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormField control={form.control} name="flat_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Select Flat *</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12"><SelectValue placeholder="Choose a flat (only flats with owners)" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {flats?.map(flat => (
                  <SelectItem key={flat.id} value={flat.id}>
                    {flat.wing ? `${flat.wing}-` : ''}{flat.flat_number}
                    {flat.members?.[0] && ` — Owner: ${flat.members[0].full_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ownerName && (
              <p className="text-sm text-muted-foreground mt-1">Flat Owner: <span className="font-medium text-foreground">{ownerName}</span></p>
            )}
            {flatHasActiveTenant && (
              <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                <AlertTriangle className="h-4 w-4" />
                <span>This flat already has an active tenant. Mark them as "Left" first.</span>
              </div>
            )}
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="full_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Tenant Name *</FormLabel>
            <FormControl><Input placeholder="Full name" className="h-12" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="mobile" render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile</FormLabel>
              <FormControl><Input placeholder="Mobile number" className="h-12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input placeholder="Email" className="h-12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="rent_amount" render={({ field }) => (
          <FormItem>
            <FormLabel>Monthly Rent (₹)</FormLabel>
            <FormControl><Input type="number" placeholder="Rent amount" className="h-12" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="aadhar_masked" render={({ field }) => (
          <FormItem>
            <FormLabel>Aadhar (Last 4 digits)</FormLabel>
            <FormControl><Input placeholder="XXXX" maxLength={4} className="h-12" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="native_address" render={({ field }) => (
          <FormItem>
            <FormLabel>Native Address</FormLabel>
            <FormControl><Input placeholder="Native / permanent address" className="h-12" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="validity_from" render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant Period From *</FormLabel>
              <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="validity_to" render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant Period To *</FormLabel>
              <FormControl><Input type="date" className="h-12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {isPeriodChanged && (
          <FormField control={form.control} name="period_change_reason" render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Period Change *</FormLabel>
              <FormControl><Textarea placeholder="Reason is mandatory when changing tenant period" className="min-h-[80px]" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Rent Agreement</label>
            <div className="mt-1">
              <label className="flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {rentAgreementFile?.name || (tenant?.rent_agreement_url ? 'Replace file' : 'Upload file')}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setRentAgreementFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Police Verification</label>
            <div className="mt-1">
              <label className="flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {policeVerificationFile?.name || (tenant?.police_verification_url ? 'Replace file' : 'Upload file')}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setPoliceVerificationFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12">Cancel</Button>
          <Button type="submit" className="flex-1 h-12" disabled={mutation.isPending || !!flatHasActiveTenant}>
            {mutation.isPending ? 'Saving...' : (tenant ? 'Update Tenant' : 'Add Tenant')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
