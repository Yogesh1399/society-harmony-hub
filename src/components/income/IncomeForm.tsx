import { useState, useEffect } from 'react';
import { getFinancialYear } from '@/lib/utils';
import { FileUploadField, type AttachedFile } from '@/components/common/FileUploadField';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { Database } from '@/integrations/supabase/db-types';

type PaymentMode = Database['public']['Enums']['payment_mode'];

const incomeSchema = z.object({
  flat_id: z.string().min(1, 'Please select a flat'),
  member_id: z.string().optional(),
  receipt_date: z.date(),
  payment_mode: z.enum(['cash', 'cheque', 'neft', 'upi', 'card'] as const),
  transaction_ref: z.string().optional(),
  bank_name: z.string().optional(),
  period_from: z.date().optional(),
  period_to: z.date().optional(),
  notes: z.string().optional(),
  breakdown: z.array(z.object({
    income_head_id: z.string().min(1, 'Select head'),
    amount: z.coerce.number().min(0, 'Amount must be positive'),
  })).min(1, 'Add at least one payment head'),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

export interface IncomeFormPrefill {
  flat_id?: string;
  member_id?: string;
  amount?: number;
  bill_ids?: string[];
  period_from?: Date;
  period_to?: Date;
  notes?: string;
}

interface IncomeFormProps {
  onClose: () => void;
  prefill?: IncomeFormPrefill;
}

export function IncomeForm({ onClose, prefill }: IncomeFormProps) {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [proofFiles, setProofFiles] = useState<AttachedFile[]>([]);

  const [selectedFlatId, setSelectedFlatId] = useState<string>(prefill?.flat_id || '');

  // Fetch flats with members
  const { data: flatsWithMembers } = useQuery({
    queryKey: ['flats_with_members', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data: flats, error: flatsError } = await supabase
        .from('flats').select('*').eq('society_id', currentSocietyId).order('flat_number');
      if (flatsError) throw flatsError;
      const { data: members, error: membersError } = await supabase
        .from('members').select('*').eq('society_id', currentSocietyId);
      if (membersError) throw membersError;
      return flats?.map(flat => ({
        ...flat,
        member: members?.find(m => m.flat_id === flat.id),
      })) || [];
    },
    enabled: !!currentSocietyId,
  });

  // Fetch income heads
  const { data: incomeHeads } = useQuery({
    queryKey: ['income_heads', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('income_heads').select('*').eq('society_id', currentSocietyId).eq('is_active', true).order('head_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      flat_id: prefill?.flat_id || '',
      member_id: prefill?.member_id || '',
      receipt_date: new Date(),
      payment_mode: 'cash',
      transaction_ref: '',
      bank_name: '',
      period_from: prefill?.period_from,
      period_to: prefill?.period_to,
      notes: prefill?.notes || '',
      breakdown: [{ income_head_id: '', amount: prefill?.amount || 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'breakdown',
  });

  // Auto-fill breakdown from pending bills when flat is selected and prefill has bill_ids
  useEffect(() => {
    if (prefill?.flat_id && prefill?.bill_ids && prefill.bill_ids.length > 0 && incomeHeads && incomeHeads.length > 0) {
      // Find the "Maintenance" income head
      const maintenanceHead = incomeHeads.find(h => h.head_name.toLowerCase().includes('maintenance'));
      if (maintenanceHead && prefill.amount) {
        form.setValue('breakdown', [{ income_head_id: maintenanceHead.id, amount: prefill.amount }]);
      }
    }
  }, [prefill, incomeHeads, form]);

  // Update member when flat changes
  useEffect(() => {
    if (selectedFlatId) {
      const flat = flatsWithMembers?.find(f => f.id === selectedFlatId);
      if (flat?.member) {
        form.setValue('member_id', flat.member.id);
      }
    }
  }, [selectedFlatId, flatsWithMembers, form]);

  const breakdown = form.watch('breakdown');
  const totalAmount = breakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const generateReceiptNumber = async () => {
    if (!currentSocietyId) return '';
    // Try new document_series system first
    try {
      const { data, error } = await supabase.rpc('generate_next_doc_number', {
        _society_id: currentSocietyId,
        _doc_type: 'income',
      });
      if (error) throw error;
      if (!data) throw new Error('Receipt number could not be generated.');
      return data as string;
    } catch (err: any) {
      // No unsafe fallback here on purpose. The old read-then-write path
      // could hand the same number to two people saving at once, which then
      // failed on the unique constraint with a confusing error.
      const msg = String(err?.message || err);
      if (/fiscal year/i.test(msg)) {
        throw new Error(
          'No open financial year for this society. Open the new financial year in Settings before adding entries.'
        );
      }
      throw new Error(`Could not generate a receipt number: ${msg}`);
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: IncomeFormValues) => {
      if (!currentSocietyId) throw new Error('No society selected');

      // Check if period is locked
      const entryDate = format(values.receipt_date, 'yyyy-MM-dd');
      const { data: locked } = await supabase.rpc('is_period_locked', {
        _society_id: currentSocietyId,
        _date: entryDate,
      });
      if (locked) throw new Error('This period is closed/finalized. Cannot add entries.');

      const receiptNumber = await generateReceiptNumber();

      // Create income entry
      const { data: entry, error: entryError } = await supabase
        .from('income_entries')
        .insert({
          society_id: currentSocietyId,
          receipt_number: receiptNumber,
          receipt_date: format(values.receipt_date, 'yyyy-MM-dd'),
          flat_id: values.flat_id,
          member_id: values.member_id || null,
          total_amount: totalAmount,
          payment_mode: values.payment_mode,
          transaction_ref: values.transaction_ref || null,
          bank_name: values.bank_name || null,
          period_from: values.period_from ? format(values.period_from, 'yyyy-MM-dd') : null,
          period_to: values.period_to ? format(values.period_to, 'yyyy-MM-dd') : null,
          notes: [
            values.notes || null,
            proofFiles.length ? `Evidence: ${proofFiles.map((f) => f.marker).join(' ')}` : null,
          ].filter(Boolean).join(' | ') || null,
        })
        .select()
        .single();
      if (entryError) throw entryError;

      // Create breakdown entries
      const breakdownData = values.breakdown
        .filter(b => b.income_head_id && b.amount > 0)
        .map(b => ({
          income_entry_id: entry.id,
          income_head_id: b.income_head_id,
          amount: b.amount,
        }));
      if (breakdownData.length > 0) {
        const { error: detailsError } = await supabase.from('income_entry_details').insert(breakdownData);
        if (detailsError) throw detailsError;
      }

      // Legacy receipt series update (kept for backward compatibility)
      try {
        const financialYear = getFinancialYear(values.receipt_date);
        const { data: currentSeries } = await supabase
          .from('receipt_series').select('current_number')
          .eq('society_id', currentSocietyId).eq('receipt_type', 'income').eq('financial_year', financialYear).single();
        if (currentSeries) {
          await supabase.from('receipt_series')
            .update({ current_number: (currentSeries.current_number || 0) + 1 })
            .eq('society_id', currentSocietyId).eq('receipt_type', 'income').eq('financial_year', financialYear);
        }
      } catch {}

      // *** INTERLINK: Update maintenance bills if bill_ids provided ***
      if (prefill?.bill_ids && prefill.bill_ids.length > 0) {
        for (const billId of prefill.bill_ids) {
          // Get current bill
          const { data: bill } = await supabase
            .from('maintenance_bills').select('*').eq('id', billId).single();
          if (bill) {
            const newPaidAmount = Number(bill.paid_amount || 0) + totalAmount;
            const billTotal = Number(bill.total_amount) + Number(bill.penalty_amount || 0) + Number(bill.interest_amount || 0);
            const newStatus = newPaidAmount >= billTotal ? 'paid' : 'partial';
            await supabase.from('maintenance_bills').update({
              paid_amount: newPaidAmount,
              paid_date: format(values.receipt_date, 'yyyy-MM-dd'),
              status: newStatus,
            }).eq('id', billId);
          }
        }
      } else {
        // Try to auto-match pending bills for this flat/member by period
        await autoMatchMaintenanceBills(
          currentSocietyId, values.flat_id, values.member_id || null,
          totalAmount, format(values.receipt_date, 'yyyy-MM-dd')
        );
      }

      // *** INTERLINK: Create credit entry in member_ledger ***
      if (values.member_id) {
        // Get current balance
        const { data: lastLedger } = await supabase
          .from('member_ledger').select('balance')
          .eq('member_id', values.member_id).eq('society_id', currentSocietyId)
          .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
          .limit(1).single();

        const currentBalance = Number(lastLedger?.balance || 0);
        const newBalance = currentBalance - totalAmount; // credit reduces balance (balance = outstanding)

        await supabase.from('member_ledger').insert({
          society_id: currentSocietyId,
          member_id: values.member_id,
          flat_id: values.flat_id,
          entry_date: format(values.receipt_date, 'yyyy-MM-dd'),
          description: `Payment received - ${receiptNumber}`,
          credit: totalAmount,
          debit: 0,
          balance: newBalance,
          reference_id: entry.id,
          reference_type: 'income_entry',
        });
      }

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_entries'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-bills'] });
      queryClient.invalidateQueries({ queryKey: ['member-ledger'] });
      toast({ title: 'Income recorded', description: 'Payment recorded and linked to maintenance.' });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (values: IncomeFormValues) => {
    if (totalAmount <= 0) {
      toast({ title: 'Error', description: 'Total amount must be greater than 0', variant: 'destructive' });
      return;
    }
    mutation.mutate(values);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Flat & Date Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="flat_id"
            render={({ field }) => {
              const flatOptions = (flatsWithMembers || []).map((f) => ({
                value: f.id,
                label: `${f.wing ? f.wing + '-' : ''}${f.flat_number}`,
                hint: f.member?.full_name || undefined,
                searchText: `${f.wing || ''} ${f.flat_number} ${f.member?.full_name || ''}`,
              }));
              return (
                <FormItem>
                  <FormLabel>Flat / Member *</FormLabel>
                  <SearchableCombobox
                    options={flatOptions}
                    value={field.value}
                    onChange={(v) => { field.onChange(v); setSelectedFlatId(v); }}
                    placeholder="Search flat or member name..."
                    searchPlaceholder="Type flat no or member name..."
                    emptyText="No matching flat"
                  />
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          <FormField
            control={form.control}
            name="receipt_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Receipt Date *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn('w-full h-12 justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, 'dd/MM/yyyy') : 'Pick a date'}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Payment Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-end">
                <FormField
                  control={form.control}
                  name={`breakdown.${index}.income_head_id`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      {index === 0 && <FormLabel>Head</FormLabel>}
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Select head" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {incomeHeads?.map((head) => (
                            <SelectItem key={head.id} value={head.id}>{head.head_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`breakdown.${index}.amount`}
                  render={({ field }) => (
                    <FormItem className="w-32">
                      {index === 0 && <FormLabel>Amount</FormLabel>}
                      <FormControl>
                        <Input type="number" min={0} placeholder="0" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-11 w-11 shrink-0">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ income_head_id: '', amount: 0 })} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add Head
            </Button>
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="font-semibold">Total Amount</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="payment_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Mode *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Select mode" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="neft">NEFT/RTGS</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="transaction_ref"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transaction Reference</FormLabel>
                <FormControl>
                  <Input placeholder="Cheque/UTR/Ref No." className="h-12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Period */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="period_from"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period From</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn('w-full h-12 justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, 'MMM yyyy') : 'Select month'}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="period_to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period To</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn('w-full h-12 justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, 'MMM yyyy') : 'Select month'}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Any additional notes..." className="resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Prefill info banner */}
        {prefill?.bill_ids && prefill.bill_ids.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-medium text-primary">Linked to {prefill.bill_ids.length} maintenance bill(s)</p>
            <p className="text-muted-foreground">Payment will automatically update bill status and member ledger.</p>
          </div>
        )}

        {/* Actions */}
                  <FileUploadField
            label="Payment Evidence"
            description="Cheque image, UPI screenshot, bank slip or any supporting proof"
            category="Payment Evidence"
            societyId={currentSocietyId || ''}
            multiple
            maxFiles={5}
            value={proofFiles}
            onChange={setProofFiles}
            className="mb-4"
          />

          <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12">Cancel</Button>
          <Button type="submit" className="flex-1 h-12" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Generate Receipt'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Auto-match pending maintenance bills for a flat when no specific bill_ids are provided */
async function autoMatchMaintenanceBills(
  societyId: string, flatId: string, memberId: string | null,
  paymentAmount: number, paymentDate: string
) {
  // Find pending/overdue bills for this flat, oldest first
  const { data: pendingBills } = await supabase
    .from('maintenance_bills')
    .select('*')
    .eq('society_id', societyId)
    .eq('flat_id', flatId)
    .in('status', ['pending', 'overdue', 'partial'])
    .order('bill_date', { ascending: true });

  if (!pendingBills || pendingBills.length === 0) return;

  let remainingAmount = paymentAmount;

  for (const bill of pendingBills) {
    if (remainingAmount <= 0) break;

    const billOutstanding = Number(bill.total_amount) + Number(bill.penalty_amount || 0) +
      Number(bill.interest_amount || 0) - Number(bill.paid_amount || 0);

    if (billOutstanding <= 0) continue;

    const payForBill = Math.min(remainingAmount, billOutstanding);
    const newPaidAmount = Number(bill.paid_amount || 0) + payForBill;
    const newStatus = newPaidAmount >= (Number(bill.total_amount) + Number(bill.penalty_amount || 0) + Number(bill.interest_amount || 0))
      ? 'paid' : 'partial';

    await supabase.from('maintenance_bills').update({
      paid_amount: newPaidAmount,
      paid_date: paymentDate,
      status: newStatus,
    }).eq('id', bill.id);

    remainingAmount -= payForBill;
  }
}
