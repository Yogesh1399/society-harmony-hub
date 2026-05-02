import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FileText, TrendingUp, TrendingDown, IndianRupee, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--primary))',
  'hsl(var(--destructive))', 'hsl(var(--info))',
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

export default function ReportsPage() {
  const { currentSocietyId } = useAuthStore();

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
  const monthlyData = (() => {
    const months: { name: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
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
  })();

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
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        {/* Income-Expense Statement */}
        <TabsContent value="statement">
          <Card>
            <CardHeader>
              <CardTitle>Income-Expense Statement</CardTitle>
              <CardDescription>Summary for the current financial year</CardDescription>
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
            <CardHeader>
              <CardTitle>Outstanding Maintenance Report</CardTitle>
              <CardDescription>
                {maintenanceBills?.length || 0} pending bills • Total outstanding: {formatCurrency(totalOutstanding)}
              </CardDescription>
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
