import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import {
  Banknote, Plus, Upload, RefreshCw, CheckCircle2, AlertCircle, Link2, Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const reconStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  matched: 'default',
  unmatched: 'outline',
  suspense: 'destructive',
  manual: 'secondary',
};

export default function BankReconciliationPage() {
  const { currentSocietyId, user } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [acctOpen, setAcctOpen] = useState(false);
  const [acct, setAcct] = useState({ account_name: '', bank_name: '', branch: '', account_number_masked: '', ifsc: '', opening_balance: '0' });
  const [stmtOpen, setStmtOpen] = useState(false);
  const [stmt, setStmt] = useState({ period_from: '', period_to: '', csv: '', file: null as File | null });
  const [reconcileFor, setReconcileFor] = useState<any>(null);

  // accounts
  const { data: accounts } = useQuery({
    queryKey: ['bank_accounts', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase.from('bank_accounts').select('*').eq('society_id', currentSocietyId).order('created_at');
      if (error) throw error;
      if (data?.length && !activeAccountId) setActiveAccountId(data[0].id);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // statements for active account
  const { data: statements } = useQuery({
    queryKey: ['bank_statements', activeAccountId],
    queryFn: async () => {
      if (!activeAccountId) return [];
      const { data, error } = await supabase.from('bank_statements').select('*').eq('bank_account_id', activeAccountId).order('period_to', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeAccountId,
  });

  // entries for active account
  const { data: entries } = useQuery({
    queryKey: ['bank_entries', activeAccountId],
    queryFn: async () => {
      if (!activeAccountId) return [];
      const { data, error } = await supabase.from('bank_entries').select('*').eq('bank_account_id', activeAccountId).order('txn_date', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeAccountId,
  });

  const stats = useMemo(() => {
    const e = entries || [];
    return {
      total: e.length,
      matched: e.filter((x: any) => x.reconciliation_status === 'matched').length,
      unmatched: e.filter((x: any) => x.reconciliation_status === 'unmatched').length,
      suspense: e.filter((x: any) => x.reconciliation_status === 'suspense').length,
      credit: e.reduce((s: number, x: any) => s + Number(x.credit || 0), 0),
      debit: e.reduce((s: number, x: any) => s + Number(x.debit || 0), 0),
    };
  }, [entries]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n);

  // create account
  const createAccount = useMutation({
    mutationFn: async () => {
      if (!currentSocietyId) throw new Error('No society');
      const { error, data } = await supabase.from('bank_accounts').insert({
        society_id: currentSocietyId,
        account_name: acct.account_name,
        bank_name: acct.bank_name,
        branch: acct.branch || null,
        account_number_masked: acct.account_number_masked || null,
        ifsc: acct.ifsc || null,
        opening_balance: Number(acct.opening_balance) || 0,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: 'Bank account added' });
      setAcctOpen(false);
      setAcct({ account_name: '', bank_name: '', branch: '', account_number_masked: '', ifsc: '', opening_balance: '0' });
      qc.invalidateQueries({ queryKey: ['bank_accounts'] });
      if (data?.id) setActiveAccountId(data.id);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  /**
   * Parse CSV: expects header row containing some of:
   * date, description, reference, debit, credit, balance
   * Tolerates dd/mm/yyyy or yyyy-mm-dd. Lines without amounts are skipped.
   */
  const parseCsv = (csv: string) => {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const idx = (k: string) => headers.findIndex((h) => h.includes(k));
    const di = idx('date');
    const desci = idx('desc') >= 0 ? idx('desc') : idx('narration');
    const refi = idx('ref') >= 0 ? idx('ref') : idx('chq');
    const debi = idx('debit') >= 0 ? idx('debit') : idx('withdraw');
    const credi = idx('credit') >= 0 ? idx('credit') : idx('deposit');
    const bali = idx('balance');

    const toIso = (s: string) => {
      const t = s.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
      const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (m) {
        const yyyy = m[3].length === 2 ? '20' + m[3] : m[3];
        return `${yyyy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
      return null;
    };

    const num = (s: string) => {
      const n = Number((s || '').replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    return lines.slice(1).map((line) => {
      const cols = line.split(',');
      const debit = debi >= 0 ? num(cols[debi]) : 0;
      const credit = credi >= 0 ? num(cols[credi]) : 0;
      return {
        txn_date: di >= 0 ? toIso(cols[di]) : null,
        description: desci >= 0 ? (cols[desci] || '').trim() : '',
        reference: refi >= 0 ? (cols[refi] || '').trim() : null,
        debit, credit,
        balance_after: bali >= 0 ? num(cols[bali]) : null,
        txn_type: debit > 0 ? 'debit' : credit > 0 ? 'credit' : 'unknown',
      };
    }).filter((r) => r.txn_date && (r.debit > 0 || r.credit > 0));
  };

  // upload statement
  const uploadStatement = useMutation({
    mutationFn: async () => {
      if (!currentSocietyId || !activeAccountId) throw new Error('Select a bank account first');
      if (!stmt.period_from || !stmt.period_to) throw new Error('Period dates required');
      const parsed = parseCsv(stmt.csv);
      if (!parsed.length) throw new Error('No valid rows parsed. Use CSV with headers: date, description, debit, credit');

      // Optional file upload
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (stmt.file) {
        const path = `${currentSocietyId}/${Date.now()}_${stmt.file.name}`;
        const { error: upErr } = await supabase.storage.from('bank-statements').upload(path, stmt.file);
        if (upErr) throw upErr;
        fileUrl = path;
        fileName = stmt.file.name;
      }

      const totalDebit = parsed.reduce((s, r) => s + r.debit, 0);
      const totalCredit = parsed.reduce((s, r) => s + r.credit, 0);

      const { data: stmtRow, error: sErr } = await supabase.from('bank_statements').insert({
        society_id: currentSocietyId,
        bank_account_id: activeAccountId,
        period_from: stmt.period_from,
        period_to: stmt.period_to,
        file_url: fileUrl,
        file_name: fileName,
        total_debit: totalDebit,
        total_credit: totalCredit,
        entry_count: parsed.length,
        parse_status: 'parsed',
        uploaded_by: user?.id,
      }).select().single();
      if (sErr) throw sErr;

      const rows = parsed.map((r) => ({
        ...r,
        society_id: currentSocietyId,
        bank_account_id: activeAccountId,
        bank_statement_id: stmtRow.id,
      }));
      const { data: inserted, error: bErr } = await supabase.from('bank_entries').insert(rows).select('id');
      if (bErr) throw bErr;
      return { count: inserted?.length || 0 };
    },
    onSuccess: ({ count }) => {
      toast({ title: 'Statement imported', description: `${count} entries added.` });
      setStmtOpen(false);
      setStmt({ period_from: '', period_to: '', csv: '', file: null });
      qc.invalidateQueries({ queryKey: ['bank_statements'] });
      qc.invalidateQueries({ queryKey: ['bank_entries'] });
    },
    onError: (e: any) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  // run auto-match across all unmatched entries
  const autoMatch = useMutation({
    mutationFn: async () => {
      const targets = (entries || []).filter((e: any) => e.reconciliation_status === 'unmatched');
      let matched = 0;
      for (const e of targets) {
        const { data } = await supabase.rpc('auto_match_bank_entry', { _bank_entry_id: e.id });
        if ((data as any)?.matched) matched++;
      }
      return { matched, total: targets.length };
    },
    onSuccess: ({ matched, total }) => {
      toast({ title: `Auto-matched ${matched} of ${total}` });
      qc.invalidateQueries({ queryKey: ['bank_entries'] });
      qc.invalidateQueries({ queryKey: ['expense_entries'] });
      qc.invalidateQueries({ queryKey: ['income_entries'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // candidates for a bank entry (manual reconcile dialog)
  const { data: candidates } = useQuery({
    queryKey: ['recon-candidates', reconcileFor?.id],
    queryFn: async () => {
      if (!reconcileFor || !currentSocietyId) return { expenses: [], incomes: [] };
      const day = reconcileFor.txn_date;
      const minus = new Date(day); minus.setDate(minus.getDate() - 15);
      const plus = new Date(day); plus.setDate(plus.getDate() + 15);
      const fromIso = minus.toISOString().slice(0, 10);
      const toIso = plus.toISOString().slice(0, 10);

      if (Number(reconcileFor.debit) > 0) {
        const { data } = await supabase.from('expense_entries')
          .select('id, voucher_number, voucher_date, vendor_name, net_amount, reconciliation_status')
          .eq('society_id', currentSocietyId)
          .eq('is_cancelled', false)
          .gte('voucher_date', fromIso).lte('voucher_date', toIso)
          .order('voucher_date');
        return { expenses: data || [], incomes: [] };
      } else {
        const { data } = await supabase.from('income_entries')
          .select('id, receipt_number, receipt_date, total_amount, reconciliation_status')
          .eq('society_id', currentSocietyId)
          .eq('is_cancelled', false)
          .gte('receipt_date', fromIso).lte('receipt_date', toIso)
          .order('receipt_date');
        return { expenses: [], incomes: data || [] };
      }
    },
    enabled: !!reconcileFor,
  });

  const manualMatch = useMutation({
    mutationFn: async (target: { type: 'expense' | 'income'; id: string }) => {
      if (!reconcileFor) return;
      if (target.type === 'expense') {
        await supabase.from('expense_entries').update({ reconciliation_status: 'reconciled', matched_bank_entry_id: reconcileFor.id }).eq('id', target.id);
        await supabase.from('bank_entries').update({
          reconciliation_status: 'manual', matched_expense_id: target.id,
          matched_at: new Date().toISOString(), matched_by: user?.id,
        }).eq('id', reconcileFor.id);
      } else {
        await supabase.from('income_entries').update({ reconciliation_status: 'reconciled', matched_bank_entry_id: reconcileFor.id }).eq('id', target.id);
        await supabase.from('bank_entries').update({
          reconciliation_status: 'manual', matched_income_id: target.id,
          matched_at: new Date().toISOString(), matched_by: user?.id,
        }).eq('id', reconcileFor.id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Matched' });
      setReconcileFor(null);
      qc.invalidateQueries({ queryKey: ['bank_entries'] });
      qc.invalidateQueries({ queryKey: ['expense_entries'] });
      qc.invalidateQueries({ queryKey: ['income_entries'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const unmatch = useMutation({
    mutationFn: async (be: any) => {
      if (be.matched_expense_id) {
        await supabase.from('expense_entries').update({ reconciliation_status: 'unreconciled', matched_bank_entry_id: null }).eq('id', be.matched_expense_id);
      }
      if (be.matched_income_id) {
        await supabase.from('income_entries').update({ reconciliation_status: 'unreconciled', matched_bank_entry_id: null }).eq('id', be.matched_income_id);
      }
      await supabase.from('bank_entries').update({
        reconciliation_status: 'unmatched', matched_expense_id: null, matched_income_id: null, matched_at: null, matched_by: null,
      }).eq('id', be.id);
    },
    onSuccess: () => {
      toast({ title: 'Unmatched' });
      qc.invalidateQueries({ queryKey: ['bank_entries'] });
      qc.invalidateQueries({ queryKey: ['expense_entries'] });
      qc.invalidateQueries({ queryKey: ['income_entries'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary" /> Bank Reconciliation
          </h1>
          <p className="text-muted-foreground">Import statements and reconcile with society books.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={acctOpen} onOpenChange={setAcctOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Add Bank Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Bank Account</DialogTitle>
                <DialogDescription>Used for tracking statement imports and reconciliation.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div><Label>Account Name *</Label><Input value={acct.account_name} onChange={(e) => setAcct({ ...acct, account_name: e.target.value })} placeholder="Society Operating A/c" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bank Name *</Label><Input value={acct.bank_name} onChange={(e) => setAcct({ ...acct, bank_name: e.target.value })} /></div>
                  <div><Label>Branch</Label><Input value={acct.branch} onChange={(e) => setAcct({ ...acct, branch: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>A/c Number (masked)</Label><Input value={acct.account_number_masked} onChange={(e) => setAcct({ ...acct, account_number_masked: e.target.value })} placeholder="XXXX1234" /></div>
                  <div><Label>IFSC</Label><Input value={acct.ifsc} onChange={(e) => setAcct({ ...acct, ifsc: e.target.value })} /></div>
                </div>
                <div><Label>Opening Balance (₹)</Label><Input type="number" value={acct.opening_balance} onChange={(e) => setAcct({ ...acct, opening_balance: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAcctOpen(false)}>Cancel</Button>
                <Button onClick={() => createAccount.mutate()} disabled={!acct.account_name || !acct.bank_name || createAccount.isPending}>
                  {createAccount.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={stmtOpen} onOpenChange={setStmtOpen}>
            <DialogTrigger asChild>
              <Button disabled={!activeAccountId}><Upload className="mr-2 h-4 w-4" /> Upload Statement</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Import Bank Statement</DialogTitle>
                <DialogDescription>
                  Paste statement rows in CSV form. Required headers: <code>date, description, debit, credit</code>. Optional: <code>reference, balance</code>.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Period From *</Label><Input type="date" value={stmt.period_from} onChange={(e) => setStmt({ ...stmt, period_from: e.target.value })} /></div>
                  <div><Label>Period To *</Label><Input type="date" value={stmt.period_to} onChange={(e) => setStmt({ ...stmt, period_to: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Original Statement File (optional)</Label>
                  <Input type="file" accept=".pdf,.csv,.xls,.xlsx" onChange={(e) => setStmt({ ...stmt, file: e.target.files?.[0] || null })} />
                </div>
                <div>
                  <Label>CSV Rows *</Label>
                  <Textarea
                    rows={10}
                    placeholder={'date,description,reference,debit,credit,balance\n01/04/2026,SALARY GUARD,REF123,5000,0,45000\n02/04/2026,MAINT RECEIPT FLAT A101,UPI/789,0,3500,48500'}
                    value={stmt.csv}
                    onChange={(e) => setStmt({ ...stmt, csv: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStmtOpen(false)}>Cancel</Button>
                <Button onClick={() => uploadStatement.mutate()} disabled={uploadStatement.isPending}>
                  {uploadStatement.isPending ? 'Importing...' : 'Import'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Account selector */}
      {accounts && accounts.length > 0 ? (
        <div className="flex items-center gap-3">
          <Label className="text-sm">Bank account:</Label>
          <Select value={activeAccountId} onValueChange={setActiveAccountId}>
            <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.account_name} — {a.bank_name} {a.account_number_masked ? `(${a.account_number_masked})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => autoMatch.mutate()} disabled={!entries?.length || autoMatch.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${autoMatch.isPending ? 'animate-spin' : ''}`} />
            Auto-match
          </Button>
        </div>
      ) : (
        <Card><CardContent className="py-12 text-center">
          <Banknote className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">Add a bank account to start importing statements.</p>
        </CardContent></Card>
      )}

      {activeAccountId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Entries" value={stats.total} />
            <StatCard label="Matched" value={stats.matched} tone="success" />
            <StatCard label="Unmatched" value={stats.unmatched} tone="warn" />
            <StatCard label="Suspense" value={stats.suspense} tone="danger" />
          </div>

          <Tabs defaultValue="entries">
            <TabsList>
              <TabsTrigger value="entries">Bank Entries</TabsTrigger>
              <TabsTrigger value="statements">Statements ({statements?.length || 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="entries">
              <Card>
                <CardHeader>
                  <CardTitle>Bank Entries</CardTitle>
                  <CardDescription>
                    Credit total: {formatCurrency(stats.credit)} · Debit total: {formatCurrency(stats.debit)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!entries?.length ? (
                    <div className="text-center py-10 text-muted-foreground">No entries yet. Upload a statement.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Ref</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((e: any) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-sm">{format(new Date(e.txn_date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="max-w-xs truncate">{e.description || '-'}</TableCell>
                            <TableCell className="text-xs">{e.reference || '-'}</TableCell>
                            <TableCell className="text-right text-destructive">{Number(e.debit) ? formatCurrency(Number(e.debit)) : '-'}</TableCell>
                            <TableCell className="text-right text-green-600">{Number(e.credit) ? formatCurrency(Number(e.credit)) : '-'}</TableCell>
                            <TableCell>
                              <Badge variant={reconStatusVariant[e.reconciliation_status] || 'outline'} className="capitalize">
                                {e.reconciliation_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {e.reconciliation_status === 'matched' || e.reconciliation_status === 'manual' ? (
                                <Button size="sm" variant="ghost" onClick={() => unmatch.mutate(e)}>
                                  <Unlink className="mr-1 h-3 w-3" /> Unmatch
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => setReconcileFor(e)}>
                                  <Link2 className="mr-1 h-3 w-3" /> Reconcile
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="statements">
              <Card>
                <CardHeader><CardTitle>Imported Statements</CardTitle></CardHeader>
                <CardContent>
                  {!statements?.length ? (
                    <div className="text-center py-10 text-muted-foreground">No statements imported.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Entries</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statements.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell>{format(new Date(s.period_from), 'dd/MM/yyyy')} – {format(new Date(s.period_to), 'dd/MM/yyyy')}</TableCell>
                            <TableCell className="text-xs">{s.file_name || '—'}</TableCell>
                            <TableCell>{s.entry_count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(s.total_debit))}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(s.total_credit))}</TableCell>
                            <TableCell><Badge variant={s.parse_status === 'parsed' ? 'default' : 'outline'}>{s.parse_status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Manual reconcile dialog */}
      <Dialog open={!!reconcileFor} onOpenChange={(o) => !o && setReconcileFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reconcile Bank Entry</DialogTitle>
            <DialogDescription>
              {reconcileFor && (
                <>
                  {format(new Date(reconcileFor.txn_date), 'dd/MM/yyyy')} · {reconcileFor.description} ·
                  {Number(reconcileFor.debit) > 0
                    ? <span className="text-destructive ml-1">Debit {formatCurrency(Number(reconcileFor.debit))}</span>
                    : <span className="text-green-600 ml-1">Credit {formatCurrency(Number(reconcileFor.credit))}</span>}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto">
            {(candidates?.expenses?.length || candidates?.incomes?.length) ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>{reconcileFor && Number(reconcileFor.debit) > 0 ? 'Vendor' : 'Receipt'}</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates?.expenses?.map((x: any) => (
                    <TableRow key={x.id}>
                      <TableCell className="font-medium">{x.voucher_number}</TableCell>
                      <TableCell>{format(new Date(x.voucher_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{x.vendor_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(x.net_amount))}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{x.reconciliation_status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={x.reconciliation_status === 'reconciled'}
                          onClick={() => manualMatch.mutate({ type: 'expense', id: x.id })}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Match
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {candidates?.incomes?.map((x: any) => (
                    <TableRow key={x.id}>
                      <TableCell className="font-medium">{x.receipt_number}</TableCell>
                      <TableCell>{format(new Date(x.receipt_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(x.total_amount))}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{x.reconciliation_status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={x.reconciliation_status === 'reconciled'}
                          onClick={() => manualMatch.mutate({ type: 'income', id: x.id })}>
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Match
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8" /> No candidate entries within ±15 days.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warn' | 'danger' }) {
  const cls = tone === 'success' ? 'text-green-600' : tone === 'warn' ? 'text-amber-600' : tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <Card><CardContent className="pt-5 pb-4">
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </CardContent></Card>
  );
}
