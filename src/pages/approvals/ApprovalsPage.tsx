import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useCommitteeRole } from '@/hooks/useCommitteeRole';
import { format } from 'date-fns';
import {
  CheckCircle, XCircle, Clock, FileText, ShieldAlert, History, Eye,
  IndianRupee, Receipt, AlertTriangle, CheckCircle2, Banknote, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ApprovalHistoryDialog } from '@/components/expenses/ApprovalHistoryDialog';

// ─── Expense flow labels ──────────────────────────────────────────────────────
const EXP_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_secretary: 'Pending Secretary',
  pending_chairman: 'Pending Chairman', approved: 'Approved', rejected: 'Rejected',
};
const EXP_STATUS_VARIANT: Record<string, any> = {
  pending_secretary: 'secondary', pending_chairman: 'secondary',
  approved: 'default', rejected: 'destructive', draft: 'outline',
};

// ─── Member payment submission labels ────────────────────────────────────────
const PAY_STATUS_CONFIG: Record<string, { label: string; variant: any; color: string }> = {
  pending:  { label: 'Pending',  variant: 'secondary',   color: 'border-l-amber-400' },
  approved: { label: 'Approved', variant: 'default',     color: 'border-l-green-500' },
  rejected: { label: 'Rejected', variant: 'destructive', color: 'border-l-red-500'   },
};

// ─── Role-based approval flow ─────────────────────────────────────────────────
// Expense flow:  Treasurer → submits → Secretary → approves → Chairman → final approve
// Member payment: Member → submits → Treasurer → reviews → creates income/expense entry → notifies member

export default function ApprovalsPage() {
  const { user, currentSocietyId } = useAuthStore();
  const { role, isChairman, isSecretary, isTreasurer } = useCommitteeRole();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Expense approval state
  const [rejectExpenseItem, setRejectExpenseItem] = useState<any>(null);
  const [rejectExpenseReason, setRejectExpenseReason] = useState('');
  const [historyEntry, setHistoryEntry] = useState<{ id: string; voucher_number: string } | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkAction, setBulkAction] = useState<null | 'approve' | 'reject'>(null);
  const [bulkReason, setBulkReason] = useState('');

  // Member payment review state
  const [reviewSubmission, setReviewSubmission] = useState<any>(null);
  const [rejectPayReason, setRejectPayReason] = useState('');
  const [rejectingPayId, setRejectingPayId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: pendingExpenses, isLoading: expLoading } = useQuery({
    queryKey: ['pending-expense-approvals', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('expense_entries')
        .select('*, expense_heads(head_name)')
        .eq('society_id', currentSocietyId)
        .in('approval_status', ['pending_secretary', 'pending_chairman'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: expHistory } = useQuery({
    queryKey: ['expense-approval-history-recent', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('expense_approval_history')
        .select('*, expense_entries(voucher_number, vendor_name, net_amount)')
        .eq('society_id', currentSocietyId)
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: memberSubmissions, isLoading: payLoading } = useQuery({
    queryKey: ['member-payment-submissions', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('member_payment_submissions')
        .select(`
          *,
          income_heads(head_name),
          expense_heads(head_name),
          members!member_payment_submissions_member_id_fkey(
            full_name, flat_id,
            flats(flat_number, wing)
          )
        `)
        .eq('society_id', currentSocietyId)
        .order('created_at', { ascending: false });
      if (error) { console.error('submissions fetch error:', error); return []; }
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: incomeHeads } = useQuery({
    queryKey: ['income-heads-for-approvals', currentSocietyId],
    queryFn: async () => {
      const { data } = await supabase.from('income_heads').select('id, head_name')
        .eq('society_id', currentSocietyId!).eq('is_active', true);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Pending member submissions count
  const pendingMemberPay = memberSubmissions?.filter(s => s.status === 'pending').length || 0;

  // ── Expense approval mutations ────────────────────────────────────────────────
  const canActOnExpense = (entry: any) =>
    (entry.approval_status === 'pending_secretary' && isSecretary) ||
    (entry.approval_status === 'pending_chairman' && isChairman);

  const buildExpenseApprove = (entry: any) => {
    if (entry.approval_status === 'pending_secretary' && isSecretary)
      return { approval_status: 'pending_chairman' as const, secretary_approved_by: user?.id, secretary_approved_at: new Date().toISOString() };
    if (entry.approval_status === 'pending_chairman' && isChairman)
      return { approval_status: 'approved' as const, chairman_approved_by: user?.id, chairman_approved_at: new Date().toISOString() };
    return null;
  };

  const approveExpenseMutation = useMutation({
    mutationFn: async (entry: any) => {
      const updates = buildExpenseApprove(entry);
      if (!updates) throw new Error('You cannot approve at this stage');
      const { error } = await supabase.from('expense_entries').update(updates).eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-expense-approvals'] }); qc.invalidateQueries({ queryKey: ['expense-approval-history-recent'] }); toast({ title: 'Expense approved' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const rejectExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!rejectExpenseItem) return;
      const { error } = await supabase.from('expense_entries').update({
        approval_status: 'rejected', rejected_by: user?.id,
        rejected_at: new Date().toISOString(), rejection_reason: rejectExpenseReason || 'Rejected',
      }).eq('id', rejectExpenseItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-expense-approvals'] }); qc.invalidateQueries({ queryKey: ['expense-approval-history-recent'] });
      toast({ title: 'Expense rejected' }); setRejectExpenseItem(null); setRejectExpenseReason('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const actionableSelected = useMemo(
    () => (pendingExpenses || []).filter((e: any) => selected[e.id] && canActOnExpense(e)),
    [pendingExpenses, selected, isSecretary, isChairman],
  );

  const bulkExpenseMutation = useMutation({
    mutationFn: async () => {
      let ok = 0; let fail = 0;
      for (const entry of actionableSelected) {
        try {
          if (bulkAction === 'approve') {
            const updates = buildExpenseApprove(entry);
            if (!updates) { fail++; continue; }
            const { error } = await supabase.from('expense_entries').update(updates).eq('id', entry.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('expense_entries').update({
              approval_status: 'rejected', rejected_by: user?.id,
              rejected_at: new Date().toISOString(), rejection_reason: bulkReason || 'Rejected (bulk)',
            }).eq('id', entry.id);
            if (error) throw error;
          }
          ok++;
        } catch { fail++; }
      }
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      qc.invalidateQueries({ queryKey: ['pending-expense-approvals'] });
      toast({ title: `${bulkAction === 'approve' ? 'Approved' : 'Rejected'} ${ok}`, description: fail ? `${fail} skipped` : undefined });
      setSelected({}); setBulkAction(null); setBulkReason('');
    },
  });

  // ── Member payment approval mutations ─────────────────────────────────────────
  const [approvePayForm, setApprovePayForm] = useState({ income_head_id: '', notes: '' });

  const approvePaymentMutation = useMutation({
    mutationFn: async (submission: any) => {
      if (!currentSocietyId || !user?.id) throw new Error('Not authenticated');

      // 1. Get receipt series
      const { data: series } = await supabase.from('receipt_series')
        .select('*').eq('society_id', currentSocietyId).eq('is_active', true).single();

      // 2. Generate receipt number
      const prefix = series?.prefix || 'RCT';
      const nextNum = (series?.current_number || 0) + 1;
      const receiptNo = `${prefix}-${String(nextNum).padStart(4, '0')}`;

      let incomeEntryId: string | null = null;
      let expenseEntryId: string | null = null;

      if (submission.is_expense_claim) {
        // Create expense entry
        const { data: vuocher } = await supabase.from('expense_entries')
          .select('voucher_number').eq('society_id', currentSocietyId)
          .order('created_at', { ascending: false }).limit(1).single();
        const lastVno = vuocher?.voucher_number?.replace(/\D/g, '') || '0';
        const nextVno = `VCH-${String(Number(lastVno) + 1).padStart(4, '0')}`;

        const { data: expEntry, error: expErr } = await supabase.from('expense_entries').insert({
          society_id: currentSocietyId,
          voucher_number: nextVno,
          voucher_date: submission.payment_date,
          vendor_name: (submission.members as any)?.full_name || 'Member',
          expense_head_id: submission.expense_head_id,
          amount: submission.amount,
          net_amount: submission.amount,
          payment_mode: submission.payment_mode,
          transaction_ref: submission.transaction_ref,
          description: `Member expense claim: ${submission.notes || ''}`,
          approved_by: user.id,
          approval_status: 'approved',
          created_by: user.id,
        }).select('id').single();
        if (expErr) throw expErr;
        expenseEntryId = expEntry.id;
      } else {
        // Create income entry
        const headId = approvePayForm.income_head_id || submission.income_head_id;
        if (!headId) throw new Error('Select income head to map this payment');

        const { data: incEntry, error: incErr } = await supabase.from('income_entries').insert({
          society_id: currentSocietyId,
          receipt_number: receiptNo,
          receipt_date: submission.payment_date,
          member_id: submission.member_id,
          flat_id: submission.flat_id,
          total_amount: submission.amount,
          payment_mode: submission.payment_mode,
          transaction_ref: submission.transaction_ref,
          bank_name: submission.bank_name,
          period_from: submission.period_month && submission.period_year
            ? `${submission.period_year}-${String(submission.period_month).padStart(2,'0')}-01` : null,
          period_to: submission.period_month && submission.period_year
            ? `${submission.period_year}-${String(submission.period_month).padStart(2,'0')}-28` : null,
          notes: approvePayForm.notes || submission.notes,
          collected_by: 'Member Self-Payment',
          created_by: user.id,
        }).select('id').single();
        if (incErr) throw incErr;
        incomeEntryId = incEntry.id;

        // Insert income entry detail
        await supabase.from('income_entry_details').insert({
          income_entry_id: incEntry.id, income_head_id: headId, amount: submission.amount,
        });

        // Increment receipt series
        if (series) {
          await supabase.from('receipt_series').update({ current_number: nextNum }).eq('id', series.id);
        }
      }

      // 3. Mark submission approved
      await supabase.from('member_payment_submissions').update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        income_entry_id: incomeEntryId,
        expense_entry_id: expenseEntryId,
      }).eq('id', submission.id);

      // 4. Notify member
      await supabase.from('member_payment_notifications').insert({
        submission_id: submission.id,
        member_id: submission.member_id,
        message: `Your payment of ₹${submission.amount} has been approved and added to the society ledger.`,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-payment-submissions'] });
      qc.invalidateQueries({ queryKey: ['income_entries'] });
      toast({ title: 'Payment approved & ledger updated' });
      setReviewSubmission(null);
      setApprovePayForm({ income_head_id: '', notes: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!rejectingPayId) return;
      await supabase.from('member_payment_submissions').update({
        status: 'rejected', reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(), rejection_reason: rejectPayReason || 'Rejected by treasurer',
      }).eq('id', rejectingPayId);

      // Notify member
      const sub = memberSubmissions?.find(s => s.id === rejectingPayId);
      if (sub) {
        await supabase.from('member_payment_notifications').insert({
          submission_id: rejectingPayId,
          member_id: sub.member_id,
          message: `Your payment of ₹${sub.amount} was rejected. Reason: ${rejectPayReason || 'Not specified'}`,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-payment-submissions'] });
      toast({ title: 'Payment rejected', variant: 'destructive' });
      setRejectingPayId(null); setRejectPayReason('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

  const allSelectableIds = (pendingExpenses || []).filter(canActOnExpense).map((e: any) => e.id);
  const allSelected = allSelectableIds.length > 0 && allSelectableIds.every(id => selected[id]);

  // Members awaiting tenant approval
  const { data: pendingTenants } = useQuery({
    queryKey: ['pending-tenants', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase.from('tenants')
        .select('*, flats(flat_number, wing), members!tenants_flat_id_fkey(full_name)')
        .eq('society_id', currentSocietyId)
        .eq('is_active', false)
        .neq('approval_status', 'rejected')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const approveTenantAdmin = useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await supabase.from('tenants').update({
        is_active: true,
        approval_status: 'approved',
        admin_approved_by: user?.id,
        admin_approved_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
      }).eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-tenants'] }); toast({ title: 'Tenant activated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const rejectTenantAdmin = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from('tenants').update({
        approval_status: 'rejected', rejection_reason: reason,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-tenants'] }); toast({ title: 'Tenant rejected' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-primary" /> Approvals</h1>
        <p className="text-muted-foreground">
          Multi-level approval centre for expenses, member payments, and tenant onboarding.
          {role && <span className="ml-2 font-medium text-foreground capitalize">Your committee role: {role}</span>}
        </p>
      </div>

      <Tabs defaultValue="member-payments">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="member-payments" className="relative">
            Member Payments
            {pendingMemberPay > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{pendingMemberPay}</span>}
          </TabsTrigger>
          <TabsTrigger value="expenses" className="relative">
            Expense Vouchers
            {(pendingExpenses?.length || 0) > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{pendingExpenses?.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="tenants" className="relative">
            Tenant Requests
            {(pendingTenants?.length || 0) > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{pendingTenants?.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="history">Activity Log</TabsTrigger>
        </TabsList>

        {/* ── MEMBER PAYMENTS TAB ──────────────────────────────────────────────── */}
        <TabsContent value="member-payments" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Member Payment Submissions</CardTitle>
              <CardDescription>
                Members submit their payment proofs here. Treasurer reviews, maps to income head, and approves — which auto-creates the ledger entry.
                {isTreasurer
                  ? <span className="text-green-700 font-medium"> ✓ You can approve these as Treasurer.</span>
                  : <span className="text-muted-foreground"> (Treasurer reviews these.)</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : memberSubmissions?.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-3 text-muted-foreground">No member payment submissions yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberSubmissions?.map(s => {
                    const member = s.members as any;
                    const flat = member?.flats;
                    const flatLabel = flat ? `${flat.wing ? flat.wing + '-' : ''}${flat.flat_number}` : '-';
                    const payCfg = PAY_STATUS_CONFIG[s.status] || PAY_STATUS_CONFIG.pending;
                    return (
                      <Card key={s.id} className={`border-l-4 ${payCfg.color}`}>
                        <CardContent className="pt-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-lg">{fmt(Number(s.amount))}</span>
                                <Badge variant="outline" className="capitalize text-xs">{s.payment_mode?.replace('_', '/')}</Badge>
                                {(s as any).is_expense_claim && <Badge variant="secondary" className="text-xs">Expense Claim</Badge>}
                                <Badge variant={payCfg.variant}>{payCfg.label}</Badge>
                              </div>
                              <p className="text-sm">
                                <span className="font-medium">{member?.full_name || 'Unknown'}</span>
                                <span className="text-muted-foreground"> · Flat {flatLabel}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {(s as any).income_heads?.head_name || (s as any).expense_heads?.head_name || s.submission_type}
                                {s.period_month && s.period_year && ` · ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][s.period_month-1]} ${s.period_year}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Payment date: {s.payment_date ? format(new Date(s.payment_date), 'dd MMM yyyy') : '-'}
                                {s.transaction_ref && ` · Ref: ${s.transaction_ref}`}
                              </p>
                              {s.notes && <p className="text-xs text-muted-foreground italic">"{s.notes}"</p>}
                            </div>
                            <div className="flex flex-col gap-2 items-end flex-shrink-0">
                              {s.attachment_url && (
                                <a href={s.attachment_url} target="_blank" rel="noreferrer">
                                  <Button size="sm" variant="outline"><Eye className="mr-1 h-4 w-4" />View Proof</Button>
                                </a>
                              )}
                              {s.status === 'pending' && (isTreasurer || isSecretary || isChairman) && (
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => { setReviewSubmission(s); setApprovePayForm({ income_head_id: s.income_head_id || '', notes: '' }); }}>
                                    <CheckCircle className="mr-1 h-4 w-4" /> Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => setRejectingPayId(s.id)}>
                                    <XCircle className="mr-1 h-4 w-4" /> Reject
                                  </Button>
                                </div>
                              )}
                              {s.status === 'rejected' && s.rejection_reason && (
                                <p className="text-xs text-destructive max-w-[200px] text-right">{s.rejection_reason}</p>
                              )}
                              {s.status === 'approved' && (
                                <span className="text-xs text-green-700 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> In ledger
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── EXPENSE VOUCHERS TAB ──────────────────────────────────────────────── */}
        <TabsContent value="expenses" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" /> Expense Voucher Approvals</CardTitle>
              <CardDescription>
                Flow: <strong>Treasurer</strong> raises → <strong>Secretary</strong> approves → <strong>Chairman</strong> final approval.
                <br />Your role: <span className="font-medium capitalize">{role || 'None'}</span>
                {isSecretary && ' — You can approve Secretary-stage vouchers'}
                {isChairman && ' — You can give final Chairman approval'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Bulk action bar */}
              {actionableSelected.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-4 rounded-md border bg-muted/40">
                  <span className="text-sm"><strong>{actionableSelected.length}</strong> selected</span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setBulkAction('approve')}><CheckCircle className="mr-1 h-4 w-4" />Approve {actionableSelected.length}</Button>
                    <Button size="sm" variant="destructive" onClick={() => setBulkAction('reject')}><XCircle className="mr-1 h-4 w-4" />Reject {actionableSelected.length}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected({})}>Clear</Button>
                  </div>
                </div>
              )}
              {expLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : !pendingExpenses?.length ? (
                <div className="text-center py-12">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-3 text-muted-foreground">All caught up — no pending expense vouchers</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allSelected} onCheckedChange={v => { const n: Record<string,boolean>={};  if(v) allSelectableIds.forEach(id=>n[id]=true); setSelected(n); }} disabled={allSelectableIds.length===0} />
                      </TableHead>
                      <TableHead>Voucher</TableHead><TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead><TableHead>Head</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Stage</TableHead><TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingExpenses.map((e: any) => {
                      const actionable = canActOnExpense(e);
                      return (
                        <TableRow key={e.id}>
                          <TableCell><Checkbox checked={!!selected[e.id]} onCheckedChange={v => setSelected(s => ({ ...s, [e.id]: !!v }))} disabled={!actionable} /></TableCell>
                          <TableCell className="font-medium">{e.voucher_number}</TableCell>
                          <TableCell>{format(new Date(e.voucher_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{e.vendor_name}</TableCell>
                          <TableCell>{e.expense_heads?.head_name || '-'}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(Number(e.net_amount))}</TableCell>
                          <TableCell><Badge variant={EXP_STATUS_VARIANT[e.approval_status] || 'outline'}>{EXP_STATUS_LABEL[e.approval_status] || e.approval_status}</Badge></TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => setHistoryEntry({ id: e.id, voucher_number: e.voucher_number })}><History className="h-4 w-4" /></Button>
                            {actionable ? (
                              <>
                                <Button size="sm" onClick={() => approveExpenseMutation.mutate(e)} disabled={approveExpenseMutation.isPending}><CheckCircle className="mr-1 h-4 w-4" />Approve</Button>
                                <Button size="sm" variant="destructive" onClick={() => setRejectExpenseItem(e)}><XCircle className="mr-1 h-4 w-4" />Reject</Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Waiting for {e.approval_status === 'pending_secretary' ? 'Secretary' : 'Chairman'}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TENANT REQUESTS TAB ───────────────────────────────────────────────── */}
        <TabsContent value="tenants" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Tenant Onboarding Requests</CardTitle>
              <CardDescription>
                Flow: Member adds tenant → Member approves → <strong>Admin/Secretary activates</strong>.
                Once approved here, tenant becomes Active and admin can create login if required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!pendingTenants?.length ? (
                <div className="text-center py-12">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-3 text-muted-foreground">No pending tenant requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTenants.map(t => {
                    const memberApproved = (t as any).approved_by_member;
                    return (
                      <Card key={t.id} className={`border-l-4 ${memberApproved ? 'border-l-blue-400' : 'border-l-amber-400'}`}>
                        <CardContent className="pt-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-semibold text-lg">{t.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Flat: {(t.flats as any)?.wing ? `${(t.flats as any).wing}-` : ''}{(t.flats as any)?.flat_number}
                                {t.mobile && ` · ${t.mobile}`}
                              </p>
                              {t.validity_from && t.validity_to && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(t.validity_from), 'dd MMM yy')} → {format(new Date(t.validity_to), 'dd MMM yy')}
                                </p>
                              )}
                              {(t as any).rent_amount && <p className="text-sm">₹{(t as any).rent_amount}/month</p>}
                              <div className="flex gap-2 items-center">
                                <Badge variant={memberApproved ? 'default' : 'secondary'}>
                                  {memberApproved ? '✓ Owner Approved' : '⏳ Awaiting Owner'}
                                </Badge>
                              </div>
                              {!memberApproved && (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Flat owner has not approved this tenant yet
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              {(isSecretary || isChairman) && memberApproved && (
                                <>
                                  <Button size="sm" onClick={() => approveTenantAdmin.mutate(t.id)} disabled={approveTenantAdmin.isPending}>
                                    <CheckCircle className="mr-1 h-4 w-4" /> Activate Tenant
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => rejectTenantAdmin.mutate({ id: t.id, reason: 'Rejected by admin' })} disabled={rejectTenantAdmin.isPending}>
                                    <XCircle className="mr-1 h-4 w-4" /> Reject
                                  </Button>
                                </>
                              )}
                              {!memberApproved && (isSecretary || isChairman) && (
                                <Button size="sm" variant="outline" onClick={() => approveTenantAdmin.mutate(t.id)}>
                                  Override & Activate
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ACTIVITY LOG ─────────────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Activity Log</CardTitle><CardDescription>Last 50 approval actions across all modules</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Voucher</TableHead><TableHead>Action</TableHead><TableHead>By Role</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {expHistory?.map((h: any) => (
                    <TableRow key={h.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => h.expense_id && setHistoryEntry({ id: h.expense_id, voucher_number: h.expense_entries?.voucher_number || '' })}>
                      <TableCell className="text-sm">{format(new Date(h.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                      <TableCell className="font-medium">{h.expense_entries?.voucher_number || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{h.action.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell className="capitalize">{h.actor_role || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{h.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {!expHistory?.length && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No activity yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Approve Member Payment Dialog ──────────────────────────────────────── */}
      <Dialog open={!!reviewSubmission} onOpenChange={o => !o && setReviewSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><IndianRupee className="h-5 w-5" />Approve Member Payment</DialogTitle>
            <DialogDescription>Map this payment to the correct income head and it will be posted to the ledger.</DialogDescription>
          </DialogHeader>
          {reviewSubmission && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-4 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Member:</span> <strong>{(reviewSubmission.members as any)?.full_name}</strong></p>
                <p><span className="text-muted-foreground">Amount:</span> <strong>{fmt(Number(reviewSubmission.amount))}</strong></p>
                <p><span className="text-muted-foreground">Payment mode:</span> {reviewSubmission.payment_mode}</p>
                <p><span className="text-muted-foreground">Payment date:</span> {reviewSubmission.payment_date ? format(new Date(reviewSubmission.payment_date), 'dd MMM yyyy') : '-'}</p>
                {reviewSubmission.transaction_ref && <p><span className="text-muted-foreground">Ref:</span> {reviewSubmission.transaction_ref}</p>}
                {reviewSubmission.notes && <p><span className="text-muted-foreground">Notes:</span> {reviewSubmission.notes}</p>}
                {reviewSubmission.attachment_url && (
                  <a href={reviewSubmission.attachment_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View payment proof →</a>
                )}
              </div>

              {!(reviewSubmission as any).is_expense_claim && (
                <div>
                  <label className="text-sm font-medium">Map to Income Head *</label>
                  <Select value={approvePayForm.income_head_id} onValueChange={v => setApprovePayForm(f => ({ ...f, income_head_id: v }))}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select income head" /></SelectTrigger>
                    <SelectContent>{incomeHeads?.map(h => <SelectItem key={h.id} value={h.id}>{h.head_name}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">This determines which income category the receipt is filed under.</p>
                </div>
              )}

              {(reviewSubmission as any).is_expense_claim && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                  <p className="font-medium text-amber-800">Expense Claim</p>
                  <p className="text-amber-700 mt-1">
                    This member paid ₹{Number(reviewSubmission.amount).toLocaleString('en-IN')} on behalf of the society.
                    {(reviewSubmission as any).adjustment_in_maintenance
                      ? ' They want it adjusted in maintenance dues.'
                      : ` Preferred reimbursement: ${(reviewSubmission as any).reimbursement_mode || 'Not specified'}`}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">Approving will create an expense voucher entry in the ledger.</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Treasurer's Note (optional)</label>
                <Textarea className="mt-1" rows={2} placeholder="Any note for the record..."
                  value={approvePayForm.notes} onChange={e => setApprovePayForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewSubmission(null)}>Cancel</Button>
            <Button
              onClick={() => approvePaymentMutation.mutate(reviewSubmission)}
              disabled={approvePaymentMutation.isPending || (!(reviewSubmission as any)?.is_expense_claim && !approvePayForm.income_head_id)}
            >
              {approvePaymentMutation.isPending ? 'Posting to ledger...' : 'Approve & Post to Ledger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Member Payment Dialog ───────────────────────────────────────── */}
      <Dialog open={!!rejectingPayId} onOpenChange={o => !o && setRejectingPayId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Member Payment</DialogTitle>
            <DialogDescription>Give a clear reason — the member will see this and can resubmit.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection..." rows={3} value={rejectPayReason} onChange={e => setRejectPayReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingPayId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectPaymentMutation.mutate()} disabled={rejectPaymentMutation.isPending}>
              {rejectPaymentMutation.isPending ? 'Rejecting...' : 'Reject & Notify Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Expense Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!rejectExpenseItem} onOpenChange={o => !o && setRejectExpenseItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Expense Voucher</DialogTitle><DialogDescription>Reason will be visible to Treasurer.</DialogDescription></DialogHeader>
          <Textarea placeholder="Reason..." rows={4} value={rejectExpenseReason} onChange={e => setRejectExpenseReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectExpenseItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectExpenseMutation.mutate()} disabled={rejectExpenseMutation.isPending}>
              {rejectExpenseMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Expense Confirm ──────────────────────────────────────────────── */}
      <AlertDialog open={!!bulkAction} onOpenChange={o => { if (!o) { setBulkAction(null); setBulkReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk {bulkAction === 'approve' ? 'Approve' : 'Reject'} {actionableSelected.length} expense(s)?</AlertDialogTitle>
            <AlertDialogDescription>{bulkAction === 'reject' ? 'These will all be marked rejected.' : 'Each will advance one approval stage.'}</AlertDialogDescription>
          </AlertDialogHeader>
          {bulkAction === 'reject' && <Textarea placeholder="Reason for all..." rows={3} value={bulkReason} onChange={e => setBulkReason(e.target.value)} />}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); bulkExpenseMutation.mutate(); }} className={bulkAction === 'reject' ? 'bg-destructive text-destructive-foreground' : ''}>
              {bulkExpenseMutation.isPending ? 'Working...' : `Confirm ${bulkAction === 'approve' ? 'Approve' : 'Reject'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ApprovalHistoryDialog open={!!historyEntry} onOpenChange={o => !o && setHistoryEntry(null)} expenseId={historyEntry?.id ?? null} voucherNumber={historyEntry?.voucher_number} />
    </div>
  );
}
