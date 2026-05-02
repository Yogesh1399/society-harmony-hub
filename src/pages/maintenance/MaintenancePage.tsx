import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { format } from 'date-fns';
import {
  Calculator, Plus, Settings, Search, Edit, Trash2, Play, Download, Eye,
  IndianRupee, Clock, AlertTriangle, CheckCircle, CreditCard, MoreHorizontal, Printer,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { IncomeForm } from '@/components/income/IncomeForm';
import type { IncomeFormPrefill } from '@/components/income/IncomeForm';
import { ReceiptPreviewDialog } from '@/components/receipts/ReceiptPreviewDialog';

export default function MaintenancePage() {
  const { currentSocietyId } = useAuthStore();
  const { currentSociety } = useSocietyStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('bills');
  const [isHeadFormOpen, setIsHeadFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [editHead, setEditHead] = useState<any>(null);
  const [headForm, setHeadForm] = useState({ head_name: '', description: '', amount: '', calculation_type: 'flat_rate', frequency: 'monthly' });
  const [generateMonth, setGenerateMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [paymentPrefill, setPaymentPrefill] = useState<IncomeFormPrefill | null>(null);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [billPreview, setBillPreview] = useState<any>(null);

  // Fetch maintenance heads
  const { data: heads } = useQuery({
    queryKey: ['maintenance-heads', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('maintenance_heads').select('*').eq('society_id', currentSocietyId).order('head_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Fetch maintenance settings
  const { data: settings } = useQuery({
    queryKey: ['maintenance-settings', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return null;
      const { data, error } = await supabase
        .from('maintenance_settings').select('*').eq('society_id', currentSocietyId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentSocietyId,
  });

  // Fetch maintenance bills
  const { data: bills } = useQuery({
    queryKey: ['maintenance-bills', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('maintenance_bills')
        .select('*, flats(flat_number, wing), members(full_name)')
        .eq('society_id', currentSocietyId)
        .order('bill_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Fetch flats and members for bill generation
  const { data: flatsWithMembers } = useQuery({
    queryKey: ['flats-members-maintenance', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('flats').select('*, members(id, full_name)').eq('society_id', currentSocietyId).neq('status', 'vacant');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Save maintenance head
  const saveHeadMutation = useMutation({
    mutationFn: async () => {
      if (!currentSocietyId) throw new Error('No society');
      const payload = {
        society_id: currentSocietyId, head_name: headForm.head_name, description: headForm.description || null,
        amount: parseFloat(headForm.amount) || 0, calculation_type: headForm.calculation_type, frequency: headForm.frequency,
      };
      if (editHead) {
        const { error } = await supabase.from('maintenance_heads').update(payload).eq('id', editHead.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('maintenance_heads').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-heads'] });
      toast({ title: editHead ? 'Head updated' : 'Head created' });
      setIsHeadFormOpen(false);
      setEditHead(null);
      setHeadForm({ head_name: '', description: '', amount: '', calculation_type: 'flat_rate', frequency: 'monthly' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Generate bills + ledger debits
  const generateBillsMutation = useMutation({
    mutationFn: async () => {
      if (!currentSocietyId || !flatsWithMembers || !heads) throw new Error('Missing data');
      const activeHeads = heads.filter(h => h.is_active);
      if (activeHeads.length === 0) throw new Error('No active maintenance heads');

      const totalAmount = activeHeads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0);
      const dueDate = settings?.due_day
        ? new Date(`${generateMonth}-${String(settings.due_day).padStart(2, '0')}`)
        : new Date(`${generateMonth}-10`);

      const billInserts = flatsWithMembers.map(flat => ({
        society_id: currentSocietyId,
        flat_id: flat.id,
        member_id: flat.members?.[0]?.id || null,
        bill_month: generateMonth,
        total_amount: totalAmount,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending' as const,
      }));

      const { data: insertedBills, error } = await supabase
        .from('maintenance_bills')
        .upsert(billInserts, { onConflict: 'society_id,flat_id,bill_month' })
        .select();
      if (error) throw error;

      // Insert bill items
      if (insertedBills) {
        const itemInserts = insertedBills.flatMap(bill =>
          activeHeads.map(head => ({
            bill_id: bill.id, head_id: head.id, head_name: head.head_name, amount: Number(head.amount) || 0,
          }))
        );
        if (itemInserts.length > 0) {
          await supabase.from('maintenance_bill_items').insert(itemInserts);
        }

        // Create ledger debit entries for each bill
        const ledgerInserts = insertedBills
          .filter(bill => bill.member_id)
          .map(bill => ({
            society_id: currentSocietyId,
            member_id: bill.member_id!,
            flat_id: bill.flat_id,
            entry_date: bill.bill_date,
            description: `Maintenance - ${bill.bill_month}`,
            debit: totalAmount,
            credit: 0,
            balance: 0, // Will be recalculated
            reference_id: bill.id,
            reference_type: 'maintenance_bill',
          }));

        if (ledgerInserts.length > 0) {
          // Calculate running balances
          for (const entry of ledgerInserts) {
            const { data: lastLedger } = await supabase
              .from('member_ledger').select('balance')
              .eq('member_id', entry.member_id).eq('society_id', currentSocietyId)
              .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
              .limit(1).single();
            entry.balance = Number(lastLedger?.balance || 0) + totalAmount;
            await supabase.from('member_ledger').insert(entry);
          }
        }
      }

      return insertedBills?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-bills'] });
      queryClient.invalidateQueries({ queryKey: ['member-ledger'] });
      toast({ title: 'Bills generated', description: `${count} bills created with ledger entries for ${generateMonth}` });
      setIsGenerateOpen(false);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Update settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (!currentSocietyId) throw new Error('No society');
      if (settings) {
        const { error } = await supabase.from('maintenance_settings').update(values).eq('id', settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-settings'] });
      toast({ title: 'Settings updated' });
    },
  });

  // Delete head
  const deleteHeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('maintenance_heads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-heads'] });
      toast({ title: 'Head deleted' });
    },
  });

  // Accept payment for a bill
  const handleAcceptPayment = (bill: any) => {
    const outstanding = Number(bill.total_amount) + Number(bill.penalty_amount || 0) +
      Number(bill.interest_amount || 0) - Number(bill.paid_amount || 0);
    setPaymentPrefill({
      flat_id: bill.flat_id,
      member_id: bill.member_id || undefined,
      amount: outstanding,
      bill_ids: [bill.id],
      period_from: new Date(bill.bill_month + '-01'),
      period_to: new Date(bill.bill_month + '-01'),
      notes: `Maintenance payment for ${bill.bill_month}`,
    });
    setIsPaymentFormOpen(true);
  };

  // View bill as receipt
  const handleViewBill = async (bill: any) => {
    const { data: items } = await supabase
      .from('maintenance_bill_items').select('*').eq('bill_id', bill.id);

    const breakdown = items?.map(item => ({
      head_name: item.head_name,
      amount: Number(item.amount),
    })) || [{ head_name: 'Maintenance', amount: Number(bill.total_amount) }];

    // Add penalty/interest if any
    if (Number(bill.penalty_amount) > 0) {
      breakdown.push({ head_name: 'Late Penalty', amount: Number(bill.penalty_amount) });
    }
    if (Number(bill.interest_amount) > 0) {
      breakdown.push({ head_name: 'Interest', amount: Number(bill.interest_amount) });
    }

    setBillPreview({
      societyName: currentSociety?.name || 'Society',
      societyAddress: currentSociety?.address || undefined,
      societyRegNo: currentSociety?.registration_no || undefined,
      receiptNumber: `MAINT/${bill.bill_month}/${bill.flats?.flat_number || ''}`,
      receiptDate: format(new Date(bill.bill_date), 'dd/MM/yyyy'),
      memberName: bill.members?.full_name || 'N/A',
      flatNumber: `${bill.flats?.wing ? bill.flats.wing + '-' : ''}${bill.flats?.flat_number || ''}`,
      paymentMode: bill.status === 'paid' ? 'paid' : 'pending',
      periodFrom: bill.bill_month,
      periodTo: bill.bill_month,
      breakdown,
      totalAmount: Number(bill.total_amount) + Number(bill.penalty_amount || 0) + Number(bill.interest_amount || 0),
      isCancelled: false,
      receiptTitle: 'Maintenance Bill',
    });
  };

  const pendingBills = bills?.filter(b => b.status === 'pending' || b.status === 'partial') || [];
  const overdueBills = bills?.filter(b => b.status === 'overdue') || [];
  const paidBills = bills?.filter(b => b.status === 'paid') || [];
  const totalOutstanding = [...pendingBills, ...overdueBills].reduce(
    (sum, b) => sum + (Number(b.total_amount) + Number(b.penalty_amount || 0) + Number(b.interest_amount || 0) - Number(b.paid_amount || 0)), 0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6" /> Maintenance Billing
          </h1>
          <p className="text-muted-foreground">Generate and manage monthly maintenance bills</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Button>
          <Button onClick={() => setIsGenerateOpen(true)}>
            <Play className="mr-2 h-4 w-4" /> Generate Bills
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><IndianRupee className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">₹{totalOutstanding.toLocaleString('en-IN')}</p>
                <p className="text-sm text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg"><Clock className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold">{pendingBills.length}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{overdueBills.length}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><CheckCircle className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{paidBills.length}</p>
                <p className="text-sm text-muted-foreground">Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="heads">Maintenance Heads</TabsTrigger>
          <TabsTrigger value="ledger">Member Ledger</TabsTrigger>
        </TabsList>

        {/* Bills Tab */}
        <TabsContent value="bills" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Bills</CardTitle>
              <CardDescription>{bills?.length || 0} bills generated</CardDescription>
            </CardHeader>
            <CardContent>
              {bills && bills.length > 0 ? (
                <>
                  {/* Desktop */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Flat</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Month</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Outstanding</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bills.map((bill: any) => {
                          const billTotal = Number(bill.total_amount) + Number(bill.penalty_amount || 0) + Number(bill.interest_amount || 0);
                          const outstanding = billTotal - Number(bill.paid_amount || 0);
                          return (
                            <TableRow key={bill.id}>
                              <TableCell className="font-medium">
                                {bill.flats?.wing ? `${bill.flats.wing}-` : ''}{bill.flats?.flat_number}
                              </TableCell>
                              <TableCell>{bill.members?.full_name || '-'}</TableCell>
                              <TableCell>{bill.bill_month}</TableCell>
                              <TableCell>₹{billTotal.toLocaleString('en-IN')}</TableCell>
                              <TableCell className="text-primary">₹{Number(bill.paid_amount || 0).toLocaleString('en-IN')}</TableCell>
                              <TableCell className={outstanding > 0 ? 'text-destructive font-semibold' : 'text-primary'}>
                                ₹{outstanding.toLocaleString('en-IN')}
                              </TableCell>
                              <TableCell>{bill.due_date ? format(new Date(bill.due_date), 'dd/MM/yy') : '-'}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  bill.status === 'paid' ? 'default' :
                                  bill.status === 'overdue' ? 'destructive' :
                                  bill.status === 'partial' ? 'secondary' : 'outline'
                                }>
                                  {bill.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewBill(bill)}>
                                      <Eye className="mr-2 h-4 w-4" /> View Bill
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleViewBill(bill)}>
                                      <Download className="mr-2 h-4 w-4" /> Download Bill
                                    </DropdownMenuItem>
                                    {bill.status !== 'paid' && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleAcceptPayment(bill)} className="text-primary">
                                          <CreditCard className="mr-2 h-4 w-4" /> Accept Payment
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden space-y-3">
                    {bills.map((bill: any) => {
                      const billTotal = Number(bill.total_amount) + Number(bill.penalty_amount || 0) + Number(bill.interest_amount || 0);
                      const outstanding = billTotal - Number(bill.paid_amount || 0);
                      return (
                        <Card key={bill.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="cursor-pointer" onClick={() => handleViewBill(bill)}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold">
                                    {bill.flats?.wing ? `${bill.flats.wing}-` : ''}{bill.flats?.flat_number}
                                  </span>
                                  <Badge variant={
                                    bill.status === 'paid' ? 'default' :
                                    bill.status === 'overdue' ? 'destructive' : 'outline'
                                  } className="text-xs">{bill.status}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{bill.members?.full_name} • {bill.bill_month}</p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewBill(bill)}>
                                    <Eye className="mr-2 h-4 w-4" /> View
                                  </DropdownMenuItem>
                                  {bill.status !== 'paid' && (
                                    <DropdownMenuItem onClick={() => handleAcceptPayment(bill)} className="text-primary">
                                      <CreditCard className="mr-2 h-4 w-4" /> Pay
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Due: {bill.due_date ? format(new Date(bill.due_date), 'dd MMM') : '-'}
                              </span>
                              <div className="text-right">
                                <span className="text-lg font-bold">₹{billTotal.toLocaleString('en-IN')}</span>
                                {outstanding > 0 && outstanding < billTotal && (
                                  <p className="text-xs text-destructive">Due: ₹{outstanding.toLocaleString('en-IN')}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Calculator className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No bills generated yet</h3>
                  <p className="text-muted-foreground">Set up maintenance heads and generate monthly bills</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Heads Tab */}
        <TabsContent value="heads" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Maintenance Heads</CardTitle>
                <CardDescription>Define charges that make up the monthly maintenance</CardDescription>
              </div>
              <Button size="sm" onClick={() => {
                setEditHead(null);
                setHeadForm({ head_name: '', description: '', amount: '', calculation_type: 'flat_rate', frequency: 'monthly' });
                setIsHeadFormOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" /> Add Head
              </Button>
            </CardHeader>
            <CardContent>
              {heads && heads.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Head Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {heads.map(head => (
                      <TableRow key={head.id}>
                        <TableCell className="font-medium">{head.head_name}</TableCell>
                        <TableCell>₹{Number(head.amount).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="capitalize">{head.calculation_type?.replace('_', ' ')}</TableCell>
                        <TableCell className="capitalize">{head.frequency}</TableCell>
                        <TableCell>
                          <Badge variant={head.is_active ? 'default' : 'secondary'}>
                            {head.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditHead(head);
                            setHeadForm({
                              head_name: head.head_name, description: head.description || '',
                              amount: String(head.amount), calculation_type: head.calculation_type || 'flat_rate',
                              frequency: head.frequency || 'monthly',
                            });
                            setIsHeadFormOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteHeadMutation.mutate(head.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No maintenance heads defined</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger" className="mt-4">
          <MemberLedgerSection societyId={currentSocietyId} />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Head Dialog */}
      <Dialog open={isHeadFormOpen} onOpenChange={setIsHeadFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editHead ? 'Edit Maintenance Head' : 'Add Maintenance Head'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Head Name *</Label>
              <Input value={headForm.head_name} onChange={e => setHeadForm(f => ({ ...f, head_name: e.target.value }))} className="h-12 mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={headForm.description} onChange={e => setHeadForm(f => ({ ...f, description: e.target.value }))} className="h-12 mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" value={headForm.amount} onChange={e => setHeadForm(f => ({ ...f, amount: e.target.value }))} className="h-12 mt-1" />
              </div>
              <div>
                <Label>Calculation Type</Label>
                <Select value={headForm.calculation_type} onValueChange={v => setHeadForm(f => ({ ...f, calculation_type: v }))}>
                  <SelectTrigger className="h-12 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat_rate">Flat Rate</SelectItem>
                    <SelectItem value="per_sqft">Per Sq. Ft.</SelectItem>
                    <SelectItem value="per_unit">Per Unit</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsHeadFormOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveHeadMutation.mutate()} disabled={!headForm.head_name || saveHeadMutation.isPending}>
                {saveHeadMutation.isPending ? 'Saving...' : editHead ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Maintenance Settings</DialogTitle>
            <DialogDescription>Configure billing rules, penalties, and interest</DialogDescription>
          </DialogHeader>
          {settings && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Due Day of Month</Label>
                  <Input type="number" min={1} max={28} defaultValue={settings.due_day || 10}
                    onBlur={e => updateSettingsMutation.mutate({ due_day: parseInt(e.target.value) })} className="h-12 mt-1" />
                </div>
                <div>
                  <Label>Grace Days</Label>
                  <Input type="number" min={0} defaultValue={settings.grace_days || 5}
                    onBlur={e => updateSettingsMutation.mutate({ grace_days: parseInt(e.target.value) })} className="h-12 mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Late Penalty (₹)</Label>
                  <Input type="number" defaultValue={settings.penalty_amount || 0}
                    onBlur={e => updateSettingsMutation.mutate({ penalty_amount: parseFloat(e.target.value) })} className="h-12 mt-1" />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input type="number" step="0.1" defaultValue={settings.interest_rate || 0}
                    onBlur={e => updateSettingsMutation.mutate({ interest_rate: parseFloat(e.target.value) })} className="h-12 mt-1" />
                </div>
              </div>
              <div>
                <Label>Interest Calculation</Label>
                <Select defaultValue={settings.interest_calculation || 'simple'}
                  onValueChange={v => updateSettingsMutation.mutate({ interest_calculation: v })}>
                  <SelectTrigger className="h-12 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple Interest</SelectItem>
                    <SelectItem value="compound">Compound Interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-2">
                <Label>Auto Generate Monthly</Label>
                <Switch checked={settings.auto_generate || false}
                  onCheckedChange={c => updateSettingsMutation.mutate({ auto_generate: c })} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Bills Dialog */}
      <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Maintenance Bills</DialogTitle>
            <DialogDescription>Generate bills for all occupied flats with ledger entries</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bill Month</Label>
              <Input type="month" value={generateMonth} onChange={e => setGenerateMonth(e.target.value)} className="h-12 mt-1" />
            </div>
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p>Active Heads: <strong>{heads?.filter(h => h.is_active).length || 0}</strong></p>
              <p>Total per Flat: <strong>₹{heads?.filter(h => h.is_active).reduce((s, h) => s + (Number(h.amount) || 0), 0).toLocaleString('en-IN')}</strong></p>
              <p>Flats to Bill: <strong>{flatsWithMembers?.length || 0}</strong></p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              Bills will auto-create debit entries in Member Ledger and can be paid via Accept Payment.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsGenerateOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => generateBillsMutation.mutate()} disabled={generateBillsMutation.isPending}>
                {generateBillsMutation.isPending ? 'Generating...' : 'Generate Bills'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accept Payment Dialog */}
      <Dialog open={isPaymentFormOpen} onOpenChange={setIsPaymentFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accept Maintenance Payment</DialogTitle>
            <DialogDescription>Record payment and auto-update bill status & member ledger</DialogDescription>
          </DialogHeader>
          <IncomeForm
            onClose={() => {
              setIsPaymentFormOpen(false);
              setPaymentPrefill(null);
            }}
            prefill={paymentPrefill || undefined}
          />
        </DialogContent>
      </Dialog>

      {/* Bill Preview Dialog */}
      <ReceiptPreviewDialog
        open={!!billPreview}
        onOpenChange={(open) => !open && setBillPreview(null)}
        data={billPreview}
      />
    </div>
  );
}

// Member Ledger sub-component
function MemberLedgerSection({ societyId }: { societyId: string | null }) {
  const [selectedMember, setSelectedMember] = useState('');

  const { data: members } = useQuery({
    queryKey: ['members-for-ledger', societyId],
    queryFn: async () => {
      if (!societyId) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, flat_id, flats(flat_number, wing)')
        .eq('society_id', societyId).eq('is_active', true).order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!societyId,
  });

  const { data: ledger } = useQuery({
    queryKey: ['member-ledger', selectedMember],
    queryFn: async () => {
      if (!selectedMember) return [];
      const { data, error } = await supabase
        .from('member_ledger').select('*')
        .eq('member_id', selectedMember)
        .order('entry_date', { ascending: true }).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedMember,
  });

  const totalDebit = ledger?.reduce((s, e) => s + Number(e.debit || 0), 0) || 0;
  const totalCredit = ledger?.reduce((s, e) => s + Number(e.credit || 0), 0) || 0;
  const closingBalance = totalDebit - totalCredit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Ledger</CardTitle>
        <CardDescription>View financial ledger with maintenance dues and payments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedMember} onValueChange={setSelectedMember}>
          <SelectTrigger className="h-12"><SelectValue placeholder="Select a member" /></SelectTrigger>
          <SelectContent>
            {members?.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name} - {(m.flats as any)?.wing ? `${(m.flats as any).wing}-` : ''}{(m.flats as any)?.flat_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedMember && ledger && ledger.length > 0 && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Dues</p>
                <p className="text-lg font-bold text-destructive">₹{totalDebit.toLocaleString('en-IN')}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-lg font-bold text-primary">₹{totalCredit.toLocaleString('en-IN')}</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={`text-lg font-bold ${closingBalance > 0 ? 'text-destructive' : 'text-primary'}`}>
                  ₹{Math.abs(closingBalance).toLocaleString('en-IN')}
                  {closingBalance < 0 && ' (Cr)'}
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(new Date(entry.entry_date), 'dd/MM/yy')}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      <Badge variant={entry.reference_type === 'income_entry' ? 'default' : 'outline'} className="text-xs">
                        {entry.reference_type === 'income_entry' ? 'Payment' :
                         entry.reference_type === 'maintenance_bill' ? 'Bill' : entry.reference_type || 'Entry'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {Number(entry.debit) > 0 ? `₹${Number(entry.debit).toLocaleString('en-IN')}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-primary">
                      {Number(entry.credit) > 0 ? `₹${Number(entry.credit).toLocaleString('en-IN')}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">₹{Number(entry.balance).toLocaleString('en-IN')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
        {selectedMember && (!ledger || ledger.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">No ledger entries found for this member</div>
        )}
      </CardContent>
    </Card>
  );
}
