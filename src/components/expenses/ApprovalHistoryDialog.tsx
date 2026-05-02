import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, FileText, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  expenseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucherNumber?: string;
}

const actionMeta: Record<string, { label: string; icon: any; cls: string }> = {
  submitted:           { label: 'Submitted',                icon: FileText,     cls: 'text-muted-foreground' },
  approved_secretary:  { label: 'Secretary approved',       icon: CheckCircle2, cls: 'text-blue-600' },
  approved_chairman:   { label: 'Chairman approved',        icon: CheckCircle2, cls: 'text-green-600' },
  rejected:            { label: 'Rejected',                 icon: XCircle,      cls: 'text-destructive' },
};

export function ApprovalHistoryDialog({ expenseId, open, onOpenChange, voucherNumber }: Props) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['approval-history', expenseId],
    queryFn: async () => {
      if (!expenseId) return [];
      const { data, error } = await supabase
        .from('expense_approval_history')
        .select('*, profiles:actor_user_id(full_name, email)')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!expenseId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Approval Timeline
          </DialogTitle>
          <DialogDescription>
            {voucherNumber ? <>Voucher <span className="font-medium text-foreground">{voucherNumber}</span></> : 'Full history of who acted, when, and why.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : !history?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No approval activity recorded for this expense.
            </div>
          ) : (
            <ol className="relative border-l border-border ml-3 space-y-6 py-2">
              {history.map((h: any) => {
                const meta = actionMeta[h.action] || { label: h.action, icon: ArrowRight, cls: 'text-muted-foreground' };
                const Icon = meta.icon;
                const actor = h.profiles?.full_name || h.profiles?.email || 'Unknown user';
                return (
                  <li key={h.id} className="ml-6">
                    <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border ${meta.cls}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{meta.label}</span>
                      {h.actor_role && <Badge variant="outline" className="capitalize">{h.actor_role}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      by <span className="text-foreground">{actor}</span> · {format(new Date(h.created_at), 'dd MMM yyyy, HH:mm')}
                    </p>
                    {h.notes && (
                      <p className="text-sm mt-2 p-2 rounded-md bg-muted/40 border">{h.notes}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
