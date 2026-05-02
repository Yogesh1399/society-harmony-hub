import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
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
import { useCommitteeRole } from '@/hooks/useCommitteeRole';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

const expenseSchema = z.object({
  voucher_date: z.date(),
  expense_head_id: z.string().min(1, 'Select expense head'),
  vendor_name: z.string().min(1, 'Vendor name is required'),
  vendor_address: z.string().optional(),
  description: z.string().optional(),
  amount: z.coerce.number().min(1, 'Amount must be positive'),
  gst_percent: z.coerce.number().min(0).max(28).default(0),
  tds_percent: z.coerce.number().min(0).max(30).default(0),
  payment_mode: z.enum(['cash', 'cheque', 'neft', 'upi', 'card'] as const),
  transaction_ref: z.string().optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.date().optional(),
  paid_by: z.string().optional(),
  approved_by: z.string().optional(),
  notes: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  onClose: () => void;
}

export function ExpenseForm({ onClose }: ExpenseFormProps) {
  const { currentSocietyId, user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role: committeeRole, isTreasurer, isChairman, isSecretary } = useCommitteeRole();
  // Only the Treasurer (and not also Chairman/Secretary/Admin) needs approval
  const requiresApproval = isTreasurer && !isChairman && !isSecretary;

  const { data: expenseHeads } = useQuery({
    queryKey: ['expense_heads', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('expense_heads')
        .select('*')
        .eq('society_id', currentSocietyId)
        .eq('is_active', true)
        .order('head_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      voucher_date: new Date(),
      expense_head_id: '',
      vendor_name: '',
      vendor_address: '',
      description: '',
      amount: 0,
      gst_percent: 0,
      tds_percent: 0,
      payment_mode: 'neft',
      transaction_ref: '',
      invoice_number: '',
      paid_by: '',
      approved_by: '',
      notes: '',
    },
  });

  const amount = form.watch('amount');
  const gstPercent = form.watch('gst_percent');
  const tdsPercent = form.watch('tds_percent');

  const gstAmount = (Number(amount) * Number(gstPercent)) / 100;
  const tdsAmount = (Number(amount) * Number(tdsPercent)) / 100;
  const netAmount = Number(amount) + gstAmount - tdsAmount;

  const generateVoucherNumber = async () => {
    if (!currentSocietyId) return '';
    // Try new document_series system first
    try {
      const { data, error } = await supabase.rpc('generate_next_doc_number', {
        _society_id: currentSocietyId,
        _doc_type: 'expense',
      });
      if (!error && data) return data as string;
    } catch {}
    // Fallback to legacy
    const financialYear = '2024-25';
    const { data: series } = await supabase
      .from('receipt_series')
      .select('*')
      .eq('society_id', currentSocietyId)
      .eq('receipt_type', 'expense')
      .eq('financial_year', financialYear)
      .single();
    if (!series) {
      await supabase.from('receipt_series').insert({
        society_id: currentSocietyId, receipt_type: 'expense', financial_year: financialYear, prefix: 'VCH', current_number: 0,
      });
      return `VCH/${financialYear}/001`;
    }
    const nextNumber = (series.current_number || 0) + 1;
    return `${series.prefix}/${financialYear}/${String(nextNumber).padStart(3, '0')}`;
  };

  const mutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      if (!currentSocietyId) throw new Error('No society selected');

      // Check if period is locked
      const entryDate = format(values.voucher_date, 'yyyy-MM-dd');
      const { data: locked } = await supabase.rpc('is_period_locked', {
        _society_id: currentSocietyId,
        _date: entryDate,
      });
      if (locked) throw new Error('This period is closed/finalized. Cannot add entries.');

      const voucherNumber = await generateVoucherNumber();

      const { data: entry, error } = await supabase
        .from('expense_entries')
        .insert({
          society_id: currentSocietyId,
          voucher_number: voucherNumber,
          voucher_date: format(values.voucher_date, 'yyyy-MM-dd'),
          expense_head_id: values.expense_head_id,
          vendor_name: values.vendor_name,
          vendor_address: values.vendor_address || null,
          description: values.description || null,
          amount: values.amount,
          gst_amount: gstAmount,
          tds_amount: tdsAmount,
          net_amount: netAmount,
          payment_mode: values.payment_mode,
          transaction_ref: values.transaction_ref || null,
          invoice_number: values.invoice_number || null,
          invoice_date: values.invoice_date ? format(values.invoice_date, 'yyyy-MM-dd') : null,
          paid_by: values.paid_by || null,
          approved_by: values.approved_by || null,
          approval_status: requiresApproval ? 'pending_secretary' : 'approved',
          raised_by_user_id: user?.id || null,
          raised_by_role: committeeRole || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Legacy receipt series update (kept for backward compatibility)
      try {
        const financialYear = '2024-25';
        const { data: currentSeries } = await supabase
          .from('receipt_series').select('current_number')
          .eq('society_id', currentSocietyId).eq('receipt_type', 'expense').eq('financial_year', financialYear).single();
        if (currentSeries) {
          await supabase.from('receipt_series')
            .update({ current_number: (currentSeries.current_number || 0) + 1 })
            .eq('society_id', currentSocietyId).eq('receipt_type', 'expense').eq('financial_year', financialYear);
        }
      } catch {}

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_entries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-expense-approvals'] });
      toast({
        title: requiresApproval ? 'Expense submitted for approval' : 'Expense recorded',
        description: requiresApproval
          ? 'Voucher generated and sent to Secretary for review.'
          : 'The voucher has been generated successfully.',
      });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (values: ExpenseFormValues) => {
    if (netAmount <= 0) {
      toast({ title: 'Error', description: 'Net amount must be positive', variant: 'destructive' });
      return;
    }
    mutation.mutate(values);
  };

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amt);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {requiresApproval && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              As Treasurer, this expense will be sent to the Secretary, then Chairman, for approval before being finalized.
            </AlertDescription>
          </Alert>
        )}
        {/* Date & Head */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="voucher_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Voucher Date *</FormLabel>
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
          <FormField
            control={form.control}
            name="expense_head_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expense Head *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Select head" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {expenseHeads?.map((head) => (
                      <SelectItem key={head.id} value={head.id}>{head.head_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Vendor Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="vendor_name"
            render={({ field }) => {
              const [vendorSearch, setVendorSearch] = useState('');
              const { data: vendors } = useQuery({
                queryKey: ['vendors-for-expense', currentSocietyId],
                queryFn: async () => {
                  const { data } = await supabase.from('vendors').select('id, vendor_name, mobile, email, services_provided').eq('society_id', currentSocietyId!).eq('is_active', true).order('vendor_name');
                  return data || [];
                },
                enabled: !!currentSocietyId,
              });
              const filtered = vendors?.filter(v => v.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase())) || [];
              return (
                <FormItem>
                  <FormLabel>Vendor / Payee *</FormLabel>
                  <Select onValueChange={(val) => {
                    const v = vendors?.find(v => v.vendor_name === val);
                    field.onChange(val);
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Search or type vendor name" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Search vendors..."
                          value={vendorSearch}
                          onChange={e => { setVendorSearch(e.target.value); if (!vendors?.find(v => v.vendor_name.toLowerCase() === e.target.value.toLowerCase())) field.onChange(e.target.value); }}
                          className="h-8"
                          onKeyDown={e => e.stopPropagation()}
                        />
                      </div>
                      {filtered.length === 0 && vendorSearch && (
                        <div className="p-3 text-center">
                          <p className="text-sm text-muted-foreground mb-2">"{vendorSearch}" not in vendor list</p>
                          <Button type="button" size="sm" variant="outline" onClick={() => { field.onChange(vendorSearch); }}>Use as vendor name</Button>
                        </div>
                      )}
                      {filtered.map((v) => (
                        <SelectItem key={v.id} value={v.vendor_name}>
                          <span className="font-medium">{v.vendor_name}</span>
                          {v.mobile && <span className="text-xs text-muted-foreground ml-2">· {v.mobile}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    <a href="/settings" className="text-primary underline">+ Add vendor to master list</a> for future use
                  </p>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          <FormField
            control={form.control}
            name="vendor_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor Address</FormLabel>
                <FormControl><Input placeholder="Address" className="h-12" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Textarea placeholder="Expense description..." className="resize-none" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount & Tax Calculations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Amount & Tax Calculation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Amount *</FormLabel>
                    <FormControl><Input type="number" min={0} placeholder="0" className="h-11" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gst_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST %</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                      <FormControl>
                        <SelectTrigger className="h-11"><SelectValue placeholder="GST %" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">No GST</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                        <SelectItem value="28">28%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tds_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TDS %</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                      <FormControl>
                        <SelectTrigger className="h-11"><SelectValue placeholder="TDS %" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">No TDS</SelectItem>
                        <SelectItem value="1">1%</SelectItem>
                        <SelectItem value="2">2%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Calculation Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Amount</span>
                <span>{formatCurrency(Number(amount) || 0)}</span>
              </div>
              {gstAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">+ GST ({gstPercent}%)</span>
                  <span>{formatCurrency(gstAmount)}</span>
                </div>
              )}
              {tdsAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">− TDS ({tdsPercent}%)</span>
                  <span className="text-destructive">-{formatCurrency(tdsAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold text-lg">
                <span>Net Payable</span>
                <span className="text-primary">{formatCurrency(netAmount)}</span>
              </div>
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
                <FormControl><Input placeholder="Cheque/UTR No." className="h-12" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="invoice_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Number</FormLabel>
                <FormControl><Input placeholder="INV-001" className="h-12" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="invoice_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Date</FormLabel>
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

        {/* Approval */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="paid_by"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paid By</FormLabel>
                <FormControl><Input placeholder="Name of person" className="h-12" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="approved_by"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Approved By</FormLabel>
                <FormControl><Input placeholder="Approver name" className="h-12" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12">Cancel</Button>
          <Button type="submit" className="flex-1 h-12" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Generate Voucher'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
