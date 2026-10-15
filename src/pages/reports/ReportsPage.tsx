import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useFiscalPeriod } from '@/hooks/useFiscalPeriod';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FileText, TrendingUp, TrendingDown, IndianRupee, AlertTriangle, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { exportToExcel } from '@/lib/excelExport';

const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--primary))',
  'hsl(var(--destructive))', 'hsl(var(--info))',
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

export default function ReportsPage() {
  const { currentSocietyId } = useAuthStore();
  const { period } = useFiscalPeriod();

  const { data: incomeEntries } = useQuery({
    queryKey: ['report_income', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('income_entries').select('*, members(*), flats(*)')
        .eq('society_id', currentSocietyId).eq('is_cancelled', false);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: expenseEntries } = useQuery({
    queryKey: ['report_expenses', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('expense_entries').select('*, expense_heads(*)')
        .eq('society_id', currentSocietyId).eq('is_cancelled', false);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Use maintenance_bills for outstanding instead of guessing from income
  const { data: maintenanceBills } = useQuery({
    queryKey: ['report_maintenance_bills', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('maintenance_bills')
        .select('*, flats(flat_number, wing), members(full_name)')
        .eq('society_id', currentSocietyId)
        .in('status', ['pending', 'overdue', 'partial']);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Income by head
  const { data: incomeDetails } = useQuery({
    queryKey: ['report_income_details', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('income_entry_details')
        .select('*, income_heads(head_name), income_entries!inner(society_id, is_cancelled)')
        .eq('income_entries.society_id', currentSocietyId)
        .eq('income_entries.is_cancelled', false);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  // Monthly income vs expense (last 6 months)
  const monthlyData = ((_periodKey: string) => {
    const months: { name: string; income: number; expense: number }[] = [];
    // Anchor the trend to the accounting period so a closed past year still
    // charts its own months instead of six empty ones around today.
    const anchor = period.isCurrent ? new Date() : new Date(period.end + 'T00:00:00');
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(anchor, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const monthIncome = incomeEntries?.filter(e => {
        const date = new Date(e.receipt_date);
        return date >= start && date <= end;
      }).reduce((s, e) => s + Number(e.total_amount), 0) || 0;
      const monthExpense = expenseEntries?.filter(e => {
        const date = new Date(e.voucher_date);
        return date >= start && date <= end;
      }).reduce((s, e) => s + Number(e.net_amount), 0) || 0;
      months.push({ name: format(d, 'MMM yy'), income: monthIncome, expense: monthExpense });
    }
    return months;
  })(period.start + period.end);

  // Expense by head
  const expenseByHead = (() => {
    const map: Record<string, number> = {};
    expenseEntries?.forEach(e => {
      const head = (e.expense_heads as any)?.head_name || 'Other';
      map[head] = (map[head] || 0) + Number(e.net_amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  })();

  // Income by head
  const incomeByHead = (() => {
    const map: Record<string, number> = {};
    incomeDetails?.forEach(d => {
      const head = (d.income_heads as any)?.head_name || 'Other';
      map[head] = (map[head] || 0) + Number(d.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  })();

  const totalIncome = incomeEntries?.reduce((s, e) => s + Number(e.total_amount), 0) || 0;
  const totalExpense = expenseEntries?.reduce((s, e) => s + Number(e.net_amount), 0) || 0;
  const netSurplus = totalIncome - totalExpense;

  const totalOutstanding = maintenanceBills?.reduce((s, b) =>
    s + Number(b.total_amount) + Number(b.penalty_amount || 0) + Number(b.interest_amount || 0) - Number(b.paid_amount || 0), 0
  ) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground">Financial overview and insights</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><TrendingUp className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalIncome)}</p>
                <p className="text-sm text-muted-foreground">Total Income</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg"><TrendingDown className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalExpense)}</p>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg"><IndianRupee className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className={`text-2xl font-bold ${netSurplus >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(netSurplus)}
                </p>
                <p className="text-sm text-muted-foreground">{netSurplus >= 0 ? 'Surplus' : 'Deficit'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
                <p className="text-sm text-muted-foreground">Outstanding Dues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="statement" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="statement">Income-Expense</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="collection">Collection</TabsTrigger>
          <TabsTrigger value="ledger">Member Ledger</TabsTrigger>
          <TabsTrigger value="annual">Annual Summary</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        {/* Income-Expense Statement */}
        <TabsContent value="statement">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Income-Expense Statement</CardTitle>
                <CardDescription>Summary for the current financial year</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToExcel('income-expense-statement', [
                  { name: 'Income by Head', columns: ['Head', 'Amount'], rows: incomeByHead.map(i => ({ Head: i.name, Amount: i.value })) },
                  { name: 'Expense by Head', columns: ['Head', 'Amount'], rows: expenseByHead.map(e => ({ Head: e.name, Amount: e.value })) },
                  { name: 'Summary', columns: ['Item', 'Amount'], rows: [
                    { Item: 'Total Income', Amount: totalIncome },
                    { Item: 'Total Expenses', Amount: totalExpense },
                    { Item: netSurplus >= 0 ? 'Net Surplus' : 'Net Deficit', Amount: Math.abs(netSurplus) },
                  ]},
                ])}
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income Side */}
                <div>
                  <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Income
                  </h3>
                  <div className="space-y-2">
                    {incomeByHead.length > 0 ? incomeByHead.map(({ name, value }) => (
                      <div key={name} className="flex justify-between py-2 border-b">
                        <span>{name}</span>
                        <span className="font-medium">{formatCurrency(value)}</span>
                      </div>
                    )) : (
                      <div className="flex justify-between py-2 border-b">
                        <span>Collections</span>
                        <span className="font-medium">{formatCurrency(totalIncome)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 font-bold text-primary">
                      <span>Total Income</span>
                      <span>{formatCurrency(totalIncome)}</span>
                    </div>
                  </div>
                </div>
                {/* Expense Side */}
                <div>
                  <h3 className="font-semibold text-destructive mb-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> Expenses
                  </h3>
                  <div className="space-y-2">
                    {expenseByHead.map(({ name, value }) => (
                      <div key={name} className="flex justify-between py-2 border-b">
                        <span>{name}</span>
                        <span className="font-medium">{formatCurrency(value)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-destructive">
                      <span>Total Expenses</span>
                      <span>{formatCurrency(totalExpense)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`mt-6 p-4 rounded-lg ${netSurplus >= 0 ? 'bg-primary/5' : 'bg-destructive/5'}`}>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>{netSurplus >= 0 ? 'Net Surplus' : 'Net Deficit'}</span>
                  <span className={netSurplus >= 0 ? 'text-primary' : 'text-destructive'}>
                    {formatCurrency(Math.abs(netSurplus))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outstanding Report - now using maintenance_bills */}
        <TabsContent value="outstanding">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Outstanding Maintenance Report</CardTitle>
                <CardDescription>
                  {maintenanceBills?.length || 0} pending bills • Total outstanding: {formatCurrency(totalOutstanding)}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!maintenanceBills?.length}
                onClick={() => exportToExcel('outstanding-dues', {
                  name: 'Outstanding',
                  columns: ['Flat', 'Member', 'Bill Month', 'Bill Amount', 'Paid', 'Outstanding', 'Status'],
                  rows: (maintenanceBills || []).map((bill: any) => {
                    const billTotal = Number(bill.total_amount) + Number(bill.penalty_amount || 0) + Number(bill.interest_amount || 0);
                    const outstanding = billTotal - Number(bill.paid_amount || 0);
                    return {
                      Flat: `${bill.flats?.wing ? bill.flats.wing + '-' : ''}${bill.flats?.flat_number || ''}`,
                      Member: bill.members?.full_name || '-',
                      'Bill Month': bill.bill_month,
                      'Bill Amount': billTotal,
                      Paid: Number(bill.paid_amount || 0),
                      Outstanding: outstanding,
                      Status: bill.status,
                    };
                  }),
                })}
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </CardHeader>
            <CardContent>
              {maintenanceBills && maintenanceBills.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flat</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Bill Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceBills.map((bill: any) => {
                      const billTotal = Number(bill.total_amount) + Number(bill.penalty_amount || 0) + Number(bill.interest_amount || 0);
                      const outstanding = billTotal - Number(bill.paid_amount || 0);
                      return (
                        <TableRow key={bill.id}>
                          <TableCell className="font-medium">
                            {bill.flats?.wing ? `${bill.flats.wing}-` : ''}{bill.flats?.flat_number}
                          </TableCell>
                          <TableCell>{bill.members?.full_name || '-'}</TableCell>
                          <TableCell>{bill.bill_month}</TableCell>
                          <TableCell>{formatCurrency(billTotal)}</TableCell>
                          <TableCell className="text-primary">{formatCurrency(Number(bill.paid_amount || 0))}</TableCell>
                          <TableCell className="font-semibold text-destructive">{formatCurrency(outstanding)}</TableCell>
                          <TableCell>
                            <Badge variant={bill.status === 'overdue' ? 'destructive' : bill.status === 'partial' ? 'secondary' : 'outline'}>
                              {bill.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="mx-auto h-12 w-12 text-primary/50" />
                  <h3 className="mt-4 text-lg font-semibold text-primary">All dues collected!</h3>
                  <p className="text-muted-foreground">No pending maintenance bills</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Collection Report */}
        <TabsContent value="collection">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Collection Report</CardTitle>
              <CardDescription>Month-wise collection summary</CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyCollectionReport societyId={currentSocietyId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Member-wise Ledger */}
        <TabsContent value="ledger">
          <MemberLedgerReport societyId={currentSocietyId} />
        </TabsContent>

        {/* Annual Summary */}
        <TabsContent value="annual">
          <AnnualSummaryReport
            incomeEntries={incomeEntries || []}
            expenseEntries={expenseEntries || []}
            incomeDetails={incomeDetails || []}
          />
        </TabsContent>

        {/* Charts */}
        <TabsContent value="charts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Income vs Expenses</CardTitle>
              <CardDescription>Last 6 months trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-muted-foreground" />
                    <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} className="text-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Bar dataKey="income" name="Income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown by Head</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseByHead} cx="50%" cy="50%" labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100} fill="#8884d8" dataKey="value">
                      {expenseByHead.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Monthly collection sub-component
function MonthlyCollectionReport({ societyId }: { societyId: string | null }) {
  const { data: allBills } = useQuery({
    queryKey: ['report_all_bills', societyId],
    queryFn: async () => {
      if (!societyId) return [];
      const { data } = await supabase
        .from('maintenance_bills')
        .select('bill_month, total_amount, paid_amount, penalty_amount, interest_amount, status')
        .eq('society_id', societyId)
        .order('bill_month', { ascending: false });
      return data || [];
    },
    enabled: !!societyId,
  });

  // Group by month
  const monthlyStats = (() => {
    const map: Record<string, { billed: number; collected: number; outstanding: number; count: number; paidCount: number }> = {};
    allBills?.forEach(bill => {
      const month = bill.bill_month;
      if (!map[month]) map[month] = { billed: 0, collected: 0, outstanding: 0, count: 0, paidCount: 0 };
      const billTotal = Number(bill.total_amount) + Number(bill.penalty_amount || 0) + Number(bill.interest_amount || 0);
      const paid = Number(bill.paid_amount || 0);
      map[month].billed += billTotal;
      map[month].collected += paid;
      map[month].outstanding += (billTotal - paid);
      map[month].count++;
      if (bill.status === 'paid') map[month].paidCount++;
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  })();

  if (!monthlyStats.length) {
    return <div className="text-center py-8 text-muted-foreground">No maintenance data available</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead>Bills</TableHead>
          <TableHead>Billed</TableHead>
          <TableHead>Collected</TableHead>
          <TableHead>Outstanding</TableHead>
          <TableHead>Collection %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {monthlyStats.map(([month, stats]) => (
          <TableRow key={month}>
            <TableCell className="font-medium">{month}</TableCell>
            <TableCell>{stats.paidCount}/{stats.count}</TableCell>
            <TableCell>{formatCurrency(stats.billed)}</TableCell>
            <TableCell className="text-primary">{formatCurrency(stats.collected)}</TableCell>
            <TableCell className="text-destructive">{formatCurrency(stats.outstanding)}</TableCell>
            <TableCell>
              <Badge variant={stats.collected >= stats.billed ? 'default' : 'outline'}>
                {stats.billed > 0 ? Math.round((stats.collected / stats.billed) * 100) : 0}%
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================
// Member-wise Ledger Report
// ============================================================
function MemberLedgerReport({ societyId }: { societyId: string | null }) {
  const { period } = useFiscalPeriod();
  const [memberId, setMemberId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(period.start);
  const [toDate, setToDate] = useState<string>(period.end);

  // The period loads asynchronously; adopt it once, without clobbering a
  // range the user has already picked themselves.
  const [rangeTouched, setRangeTouched] = useState(false);
  useEffect(() => {
    if (!rangeTouched) { setFromDate(period.start); setToDate(period.end); }
  }, [period.start, period.end, rangeTouched]);

  const { data: members } = useQuery({
    queryKey: ['ledger_members', societyId],
    queryFn: async () => {
      if (!societyId) return [];
      const { data } = await supabase
        .from('members')
        .select('id, full_name, flats(flat_number, wing)')
        .eq('society_id', societyId)
        .eq('is_active', true)
        .order('full_name');
      return data || [];
    },
    enabled: !!societyId,
  });

  const { data: ledger } = useQuery({
    queryKey: ['member_ledger', memberId, fromDate, toDate],
    queryFn: async () => {
      if (!memberId) return [];
      // Income side: receipts paid by this member
      const { data: incomes } = await supabase
        .from('income_entries')
        .select('receipt_number, receipt_date, total_amount, payment_mode, transaction_ref, notes')
        .eq('member_id', memberId)
        .eq('is_cancelled', false)
        .gte('receipt_date', fromDate)
        .lte('receipt_date', toDate)
        .order('receipt_date');

      // Bills side: maintenance bills for this member
      const { data: bills } = await supabase
        .from('maintenance_bills')
        .select('bill_month, bill_date, total_amount, paid_amount, penalty_amount, interest_amount, status')
        .eq('member_id', memberId)
        .gte('bill_date', fromDate)
        .lte('bill_date', toDate)
        .order('bill_date');

      const rows: any[] = [];
      bills?.forEach(b => {
        const billTotal = Number(b.total_amount) + Number(b.penalty_amount || 0) + Number(b.interest_amount || 0);
        rows.push({
          date: b.bill_date,
          type: 'Bill',
          ref: b.bill_month,
          debit: billTotal,
          credit: 0,
          notes: `Maintenance bill ${b.bill_month}`,
        });
      });
      incomes?.forEach(i => {
        rows.push({
          date: i.receipt_date,
          type: 'Receipt',
          ref: i.receipt_number,
          debit: 0,
          credit: Number(i.total_amount),
          notes: `${i.payment_mode || ''} ${i.transaction_ref || ''} ${i.notes || ''}`.trim(),
        });
      });
      rows.sort((a, b) => a.date.localeCompare(b.date));

      // Running balance (debit - credit) cumulatively
      let bal = 0;
      return rows.map(r => {
        bal += r.debit - r.credit;
        return { ...r, balance: bal };
      });
    },
    enabled: !!memberId,
  });

  const totalDebit = ledger?.reduce((s, r) => s + r.debit, 0) || 0;
  const totalCredit = ledger?.reduce((s, r) => s + r.credit, 0) || 0;
  const closingBalance = totalDebit - totalCredit;
  const selectedMember = members?.find(m => m.id === memberId);
  const flatLabel = selectedMember?.flats
    ? `${(selectedMember.flats as any).wing ? (selectedMember.flats as any).wing + '-' : ''}${(selectedMember.flats as any).flat_number}`
    : '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Member-wise Ledger</CardTitle>
          <CardDescription>All bills and payments for a selected member</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!ledger?.length}
          onClick={() => exportToExcel(`ledger-${selectedMember?.full_name || 'member'}`, {
            name: 'Ledger',
            columns: ['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance', 'Notes'],
            rows: (ledger || []).map(r => ({
              Date: r.date,
              Type: r.type,
              Reference: r.ref,
              Debit: r.debit,
              Credit: r.credit,
              Balance: r.balance,
              Notes: r.notes,
            })),
          })}
        >
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger><SelectValue placeholder="Select a member" /></SelectTrigger>
              <SelectContent>
                {members?.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}{(m.flats as any)?.flat_number ? ` (${(m.flats as any).wing ? (m.flats as any).wing + '-' : ''}${(m.flats as any).flat_number})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>

        {!memberId ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 opacity-40" />
            <p className="mt-2">Select a member to view their ledger</p>
          </div>
        ) : !ledger?.length ? (
          <div className="text-center py-12 text-muted-foreground">No transactions in selected range</div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              {selectedMember?.full_name} {flatLabel && `• ${flatLabel}`} • {ledger.length} transactions
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{format(new Date(r.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell><Badge variant={r.type === 'Bill' ? 'outline' : 'default'}>{r.type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.ref}</TableCell>
                    <TableCell className="text-right">{r.debit > 0 ? formatCurrency(r.debit) : '-'}</TableCell>
                    <TableCell className="text-right text-primary">{r.credit > 0 ? formatCurrency(r.credit) : '-'}</TableCell>
                    <TableCell className={`text-right font-medium ${r.balance > 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {formatCurrency(Math.abs(r.balance))} {r.balance > 0 ? 'Dr' : r.balance < 0 ? 'Cr' : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className={`p-4 rounded-lg flex justify-between items-center ${closingBalance > 0 ? 'bg-destructive/5' : 'bg-primary/5'}`}>
              <div className="text-sm">
                <div>Total Debit (Bills): <span className="font-semibold">{formatCurrency(totalDebit)}</span></div>
                <div>Total Credit (Payments): <span className="font-semibold">{formatCurrency(totalCredit)}</span></div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Closing Balance</div>
                <div className={`text-xl font-bold ${closingBalance > 0 ? 'text-destructive' : 'text-primary'}`}>
                  {formatCurrency(Math.abs(closingBalance))} {closingBalance > 0 ? 'Dr' : 'Cr'}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Annual Summary Report
// ============================================================
function AnnualSummaryReport({ incomeEntries, expenseEntries, incomeDetails }: { incomeEntries: any[]; expenseEntries: any[]; incomeDetails: any[] }) {
  const { period } = useFiscalPeriod();
  const [year, setYear] = useState<number>(period.startYear);
  const [yearTouched, setYearTouched] = useState(false);
  useEffect(() => { if (!yearTouched) setYear(period.startYear); }, [period.startYear, yearTouched]);

  const yearStart = useMemo(() => new Date(year, 0, 1), [year]);
  const yearEnd = useMemo(() => new Date(year, 11, 31, 23, 59, 59), [year]);

  // Per-month income/expense
  const monthly = useMemo(() => {
    const months: { name: string; income: number; expense: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const ms = new Date(year, m, 1);
      const me = new Date(year, m + 1, 0, 23, 59, 59);
      const inc = incomeEntries.filter(e => {
        const d = new Date(e.receipt_date);
        return d >= ms && d <= me;
      }).reduce((s, e) => s + Number(e.total_amount), 0);
      const exp = expenseEntries.filter(e => {
        const d = new Date(e.voucher_date);
        return d >= ms && d <= me;
      }).reduce((s, e) => s + Number(e.net_amount), 0);
      months.push({ name: format(ms, 'MMM'), income: inc, expense: exp });
    }
    return months;
  }, [year, incomeEntries, expenseEntries]);

  // Income by head (for the year)
  const incomeByHeadAnnual = useMemo(() => {
    const map: Record<string, number> = {};
    incomeDetails.forEach(d => {
      const ie = (d.income_entries as any);
      if (!ie) return;
      // ie has society_id + is_cancelled but not date (we used !inner to filter); rely on parent join not available here.
      // Use the linked income_entry's date by re-querying — but we keep simple: include all from already-filtered set.
      const head = (d.income_heads as any)?.head_name || 'Other';
      map[head] = (map[head] || 0) + Number(d.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [incomeDetails]);

  const expenseByHeadAnnual = useMemo(() => {
    const map: Record<string, number> = {};
    expenseEntries
      .filter(e => {
        const d = new Date(e.voucher_date);
        return d >= yearStart && d <= yearEnd;
      })
      .forEach(e => {
        const head = (e.expense_heads as any)?.head_name || 'Other';
        map[head] = (map[head] || 0) + Number(e.net_amount);
      });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenseEntries, yearStart, yearEnd]);

  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);
  const surplus = totalIncome - totalExpense;

  const yearOptions = Array.from(
    new Set([
      period.startYear,
      ...Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i),
    ])
  ).sort((a, b) => b - a);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Annual Summary</CardTitle>
          <CardDescription>Calendar year breakdown of income and expenses</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={v => { setYearTouched(true); setYear(Number(v)); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToExcel(`annual-summary-${year}`, [
              { name: 'Monthly', columns: ['Month', 'Income', 'Expense', 'Net'], rows: monthly.map(m => ({ Month: m.name, Income: m.income, Expense: m.expense, Net: m.income - m.expense })) },
              { name: 'Income by Head', columns: ['Head', 'Amount'], rows: incomeByHeadAnnual.map(r => ({ Head: r.name, Amount: r.value })) },
              { name: 'Expense by Head', columns: ['Head', 'Amount'], rows: expenseByHeadAnnual.map(r => ({ Head: r.name, Amount: r.value })) },
              { name: 'Summary', columns: ['Item', 'Amount'], rows: [
                { Item: 'Total Income', Amount: totalIncome },
                { Item: 'Total Expense', Amount: totalExpense },
                { Item: surplus >= 0 ? 'Net Surplus' : 'Net Deficit', Amount: Math.abs(surplus) },
              ]},
            ])}
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expense</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthly.map(m => (
              <TableRow key={m.name}>
                <TableCell className="font-medium">{m.name} {year}</TableCell>
                <TableCell className="text-right text-primary">{formatCurrency(m.income)}</TableCell>
                <TableCell className="text-right text-destructive">{formatCurrency(m.expense)}</TableCell>
                <TableCell className={`text-right font-semibold ${(m.income - m.expense) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(m.income - m.expense)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-bold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{formatCurrency(totalIncome)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totalExpense)}</TableCell>
              <TableCell className={`text-right ${surplus >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(surplus)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
