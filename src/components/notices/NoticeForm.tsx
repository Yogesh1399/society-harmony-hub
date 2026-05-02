import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
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

const noticeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  visible_to: z.string().default('all'),
});

type NoticeFormValues = z.infer<typeof noticeSchema>;

export function NoticeForm({ onClose }: { onClose: () => void }) {
  const { currentSocietyId, user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: { title: '', content: '', visible_to: 'all' },
  });

  const mutation = useMutation({
    mutationFn: async (values: NoticeFormValues) => {
      if (!currentSocietyId) throw new Error('No society selected');
      const { error } = await supabase.from('notices').insert({
        society_id: currentSocietyId,
        title: values.title,
        content: values.content,
        notice_date: format(new Date(), 'yyyy-MM-dd'),
        visible_to: values.visible_to,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      toast({ title: 'Notice created successfully' });
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
            <FormControl><Input placeholder="Notice title" className="h-12" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="content" render={({ field }) => (
          <FormItem>
            <FormLabel>Content *</FormLabel>
            <FormControl><Textarea placeholder="Notice content..." rows={5} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="visible_to" render={({ field }) => (
          <FormItem>
            <FormLabel>Visible To</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="committee">Committee Only</SelectItem>
                <SelectItem value="owners">Flat Owners</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12">Cancel</Button>
          <Button type="submit" className="flex-1 h-12" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create Notice'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
