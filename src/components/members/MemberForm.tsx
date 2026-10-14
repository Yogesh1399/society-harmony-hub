import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/db-types';
import { FileUploadField, type AttachedFile } from '@/components/common/FileUploadField';

type Member = Database['public']['Tables']['members']['Row'];

const memberSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  mobile: z.string().optional(),
  flat_id: z.string().optional(),
  aadhar_masked: z.string().optional(),
  pan_masked: z.string().optional(),
  is_active: z.boolean().default(true),
});

type MemberFormValues = z.infer<typeof memberSchema>;

interface MemberFormProps {
  member?: Member | null;
  onClose: () => void;
}

export function MemberForm({ member, onClose }: MemberFormProps) {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [photoFiles, setPhotoFiles] = useState<AttachedFile[]>([]);
  const [memberDocs, setMemberDocs] = useState<AttachedFile[]>([]);


  // Fetch unassigned flats + current member's flat when editing
  const { data: flats } = useQuery({
    queryKey: ['available-flats', currentSocietyId, member?.id],
    queryFn: async () => {
      if (!currentSocietyId) return [];

      const { data: allFlats, error } = await supabase
        .from('flats')
        .select('id, flat_number, wing, members(id, flat_id)')
        .eq('society_id', currentSocietyId)
        .order('flat_number');
      if (error) throw error;

      return (allFlats || []).filter(flat => {
        const members = flat.members as any[];
        // Show flat if: no member assigned, OR the assigned member IS the one being edited
        if (!members || members.length === 0) return true;
        if (member?.flat_id === flat.id) return true;
        return false;
      });
    },
    enabled: !!currentSocietyId,
  });

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      full_name: member?.full_name || '',
      email: member?.email || '',
      mobile: member?.mobile || '',
      // CRITICAL FIX: always pre-populate flat_id when editing
      flat_id: member?.flat_id || '',
      aadhar_masked: member?.aadhar_masked || '',
      pan_masked: member?.pan_masked || '',
      is_active: member?.is_active ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: MemberFormValues) => {
      if (!currentSocietyId) throw new Error('No society selected');

      const memberData = {
        full_name: values.full_name,
        email: values.email || null,
        mobile: values.mobile || null,
        // CRITICAL FIX: if editing and flat_id is empty string, keep existing flat_id instead of nullifying
        flat_id: values.flat_id || (member?.flat_id ?? null),
        aadhar_masked: values.aadhar_masked || null,
        pan_masked: values.pan_masked || null,
        is_active: values.is_active,
        society_id: currentSocietyId,
        // Uploads happen immediately on selection, so these are already stored
        ...(photoFiles.length ? { photo_url: photoFiles[0].marker } : {}),
        ...(memberDocs.length ? { share_certificate_url: memberDocs[0].marker } : {}),
      };

      if (member) {
        const { error } = await supabase
          .from('members')
          .update(memberData)
          .eq('id', member.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('members').insert(memberData);
        if (error) {
          if (error.message?.includes('members_flat_id_unique')) {
            throw new Error('This flat already has a member assigned.');
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['available-flats'] });
      toast({
        title: member ? 'Member updated' : 'Member added',
        description: member ? 'Member updated successfully.' : 'New member added.',
      });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const currentFlatLabel = () => {
    if (!member?.flat_id || !flats) return null;
    const flat = flats.find(f => f.id === member.flat_id);
    return flat ? `${flat.wing ? flat.wing + '-' : ''}${flat.flat_number} (current)` : null;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter full name" className="h-12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="flat_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Flat
                {member?.flat_id && (
                  <span className="ml-2 text-xs text-green-600 font-normal">
                    ✓ Currently assigned: {currentFlatLabel()}
                  </span>
                )}
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || member?.flat_id || ''}
              >
                <FormControl>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder={member?.flat_id ? 'Keep current flat or change' : 'Select a flat'} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {flats?.map((flat) => (
                    <SelectItem key={flat.id} value={flat.id}>
                      {flat.wing ? `${flat.wing}-` : ''}{flat.flat_number}
                      {flat.id === member?.flat_id ? ' (current)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {flats?.length === 0 && !member?.flat_id && (
                <p className="text-sm text-amber-600">All flats are assigned. Free a flat first to reassign.</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="mobile" render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile</FormLabel>
              <FormControl><Input placeholder="10-digit mobile" className="h-12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input type="email" placeholder="email@example.com" className="h-12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="aadhar_masked" render={({ field }) => (
            <FormItem>
              <FormLabel>Aadhar (Last 4 digits)</FormLabel>
              <FormControl><Input placeholder="XXXX" maxLength={4} className="h-12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="pan_masked" render={({ field }) => (
            <FormItem>
              <FormLabel>PAN (Last 4 chars)</FormLabel>
              <FormControl><Input placeholder="XXXX" maxLength={4} className="h-12" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <FileUploadField
            label="Member Photo"
            description="JPG, PNG or WEBP · up to 10 MB"
            accept=".jpg,.jpeg,.png,.webp"
            category="Member Photo"
            societyId={currentSocietyId || ''}
            entityId={member?.id}
            value={photoFiles}
            onChange={setPhotoFiles}
          />

          <FileUploadField
            label="Member Documents"
            description="Share certificate, sale deed, Index-2, ID proof · PDF or image"
            category="Member Document"
            societyId={currentSocietyId || ''}
            entityId={member?.id}
            multiple
            maxFiles={5}
            value={memberDocs}
            onChange={setMemberDocs}
          />
        </div>

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <FormLabel className="text-base">Active Status</FormLabel>
                <p className="text-sm text-muted-foreground">Is this member currently active?</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12">Cancel</Button>
          <Button type="submit" className="flex-1 h-12" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : member ? 'Update Member' : 'Add Member'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
