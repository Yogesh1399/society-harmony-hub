import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadPrivateFile } from '@/lib/fileStorage';
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
import { Upload, X } from 'lucide-react';

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
  const [attachment, setAttachment] = useState<File | null>(null);

  const form = useForm<NoticeFormValues>({
    resolver: zodResolver(noticeSchema),
    defaultValues: { title: '', content: '', visible_to: 'all' },
  });

  const uploadAttachment = async (noticeId: string) => {
    if (!attachment) return null;
    const saved = await uploadPrivateFile({
      file: attachment,
      societyId: currentSocietyId!,
      category: 'Notice Attachment',
      entityId: noticeId,
    });
    return `php://${saved.id}`;
  };

  const mutation = useMutation({
    mutationFn: async (values: NoticeFormValues) => {
      if (!currentSocietyId) throw new Error('No society selected');
      const noticeId = crypto.randomUUID();
      const attachmentUrl = await uploadAttachment(noticeId);
      const { error } = await supabase.from('notices').insert({
        id: noticeId,
        society_id: currentSocietyId,
        title: values.title,
        content: values.content,
        notice_date: format(new Date(), 'yyyy-MM-dd'),
        visible_to: values.visible_to,
        created_by: user?.id || null,
        attachment_url: attachmentUrl,
        attachment_name: attachment?.name || null,
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

        <div>
          <label className="text-sm font-medium">Attachment (optional)</label>
          <div className="mt-1 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-2 text-sm hover:bg-accent w-fit">
              <Upload className="h-4 w-4" />
              {attachment ? 'Replace file' : 'Choose file'}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
              />
            </label>
            {attachment && (
              <div className="flex items-center gap-1 text-xs bg-accent rounded px-2 py-1">
                <span className="truncate max-w-[180px]">{attachment.name}</span>
                <button type="button" onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

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
