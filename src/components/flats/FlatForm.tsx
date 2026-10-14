import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/db-types';

type Flat = Database['public']['Tables']['flats']['Row'];
type FlatStatus = Database['public']['Enums']['flat_status'];

const flatSchema = z.object({
  flat_number: z.string().min(1, 'Flat number is required'),
  wing: z.string().optional(),
  floor: z.coerce.number().optional(),
  area_sqft: z.coerce.number().optional(),
  parking_slots: z.coerce.number().min(0).default(0),
  status: z.enum(['owner_occupied', 'rented', 'vacant', 'available_for_tenant', 'tenant_occupied', 'under_transfer', 'builder_owned', 'society_owned'] as const).default('vacant'),
});

type FlatFormValues = z.infer<typeof flatSchema>;

interface FlatFormProps {
  flat?: Flat | null;
  onClose: () => void;
}

export function FlatForm({ flat, onClose }: FlatFormProps) {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FlatFormValues>({
    resolver: zodResolver(flatSchema),
    defaultValues: {
      flat_number: flat?.flat_number || '',
      wing: flat?.wing || '',
      floor: flat?.floor ?? undefined,
      area_sqft: flat?.area_sqft ? Number(flat.area_sqft) : undefined,
      parking_slots: flat?.parking_slots || 0,
      status: ((flat?.status as any) || 'vacant') as FlatFormValues['status'],
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FlatFormValues) => {
      if (!currentSocietyId) throw new Error('No society selected');

      // Check for duplicate flat number in same wing
      const { data: existing } = await supabase
        .from('flats')
        .select('id')
        .eq('society_id', currentSocietyId)
        .eq('flat_number', values.flat_number)
        .eq('wing', values.wing || '');
      
      const isDuplicate = existing?.some(f => f.id !== flat?.id);
      if (isDuplicate) {
        throw new Error(`Flat ${values.flat_number} already exists in ${values.wing ? `Wing ${values.wing}` : 'this society'}. Same flat cannot be added in the same wing.`);
      }

      const flatData = {
        flat_number: values.flat_number,
        wing: values.wing || null,
        floor: values.floor ?? null,
        area_sqft: values.area_sqft ?? null,
        parking_slots: values.parking_slots || 0,
        status: values.status,
        society_id: currentSocietyId,
      };

      if (flat) {
        const { error } = await supabase
          .from('flats')
          .update(flatData)
          .eq('id', flat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('flats').insert(flatData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flats'] });
      toast({
        title: flat ? 'Flat updated' : 'Flat created',
        description: flat ? 'The flat has been updated successfully.' : 'The new flat has been added.',
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (values: FlatFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="flat_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Flat Number *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., A-101" className="h-12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="wing"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Wing</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., A" className="h-12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="floor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Floor</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g., 1"
                    className="h-12"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="area_sqft"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Area (sq.ft)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g., 1000"
                    className="h-12"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="parking_slots"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parking Slots</FormLabel>
                <FormControl>
                  <Input type="number" min={0} className="h-12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="owner_occupied">Owner Occupied</SelectItem>
                    <SelectItem value="available_for_tenant">Available for Tenant</SelectItem>
                    <SelectItem value="tenant_occupied">Tenant Occupied</SelectItem>
                    <SelectItem value="rented">Rented</SelectItem>
                    <SelectItem value="vacant">Vacant</SelectItem>
                    <SelectItem value="under_transfer">Under Transfer</SelectItem>
                    <SelectItem value="builder_owned">Builder Owned</SelectItem>
                    <SelectItem value="society_owned">Society Owned</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 h-12"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : flat ? 'Update Flat' : 'Add Flat'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
