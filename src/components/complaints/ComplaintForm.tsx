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

const complaintSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  flat_id: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high'] as const).default('medium'),
});

type ComplaintFormValues = z.infer<typeof complaintSchema>;

export function ComplaintForm({ onClose }: { onClose: () => void }) {
  const { currentSocietyId, user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: flats } = useQuery({
    queryKey: ['flats', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase.from('flats').select('*').eq('society_id', currentSocietyId).order('flat_number');
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const form = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintSchema),
    defaultValues: { title: '', description: '', category: '', flat_id: '', priority: 'medium' },
  });

  const mutation = useMutation({
    mutationFn: async (values: ComplaintFormValues) => {
      if (!currentSocietyId) throw new Error('No society selected');
      const { error } = await supabase.from('complaints').insert({
        society_id: currentSocietyId,
        title: values.title,
        description: values.description || null,
        category: values.category || null,
        flat_id: values.flat_id || null,
        priority: values.priority,
        raised_by: user?.id || null,
        status: 'open',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      toast({ title: 'Complaint raised successfully' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>Title *</FormLabel>
            <FormControl><Input placeholder="Brief complaint title" className="h-12" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl><Textarea placeholder="Detailed description..." rows={4} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="cleanliness">Cleanliness</SelectItem>
                  <SelectItem value="noise">Noise</SelectItem>
                  <SelectItem value="parking">Parking</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="priority" render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="flat_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Related Flat</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select flat (optional)" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {flats?.map(flat => (
                  <SelectItem key={flat.id} value={flat.id}>
                    {flat.wing ? `${flat.wing}-` : ''}{flat.flat_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12">Cancel</Button>
          <Button type="submit" className="flex-1 h-12" disabled={mutation.isPending}>
            {mutation.isPending ? 'Submitting...' : 'Submit Complaint'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
