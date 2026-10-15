import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Building2, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight, ArrowDownRight, Plus, Download, UserCheck, Users, FileText, Bell,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSocietyStore } from '@/stores/societyStore';
import { useAuthStore } from '@/stores/authStore';
import { useFiscalPeriod } from '@/hooks/useFiscalPeriod';
import { cn } from '@/lib/utils';

function StatCard({
  title, value, subtitle, icon: Icon, trend, trendValue, variant = 'default', onClick,
}: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down'; trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  onClick?: () => void;
}) {
  const iconStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-accent text-accent-foreground',
    warning: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive/10 text-destructive',
  };

  return (
    <Card className={cn(onClick && 'cursor-pointer hover:shadow-md transition-shadow')} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn('rounded-full p-2', iconStyles[variant])}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        {trend && trendValue && (
          <div className={cn('flex items-center text-sm mt-2', trend === 'up' ? 'text-primary' : 'text-destructive')}>
            {trend === 'up' ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
            <span>{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentSociety } = useSocietyStore();
  const { profile, getCurrentRole, currentSocietyId } = useAuthStore();
  const { period } = useFiscalPeriod();
  const currentRole = getCurrentRole();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const { data: flats } = useQuery({
    queryKey: ['dashboard_flats', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase.from('flats').select('id, status').eq('society_id', currentSocietyId);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: members } = useQuery({
    queryKey: ['dashboard_members', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase.from('members').select('id, is_active').eq('society_id', currentSocietyId);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: activeTenants } = useQuery({
    queryKey: ['dashboard_tenants', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase.from('tenants').select('id').eq('society_id', currentSocietyId).eq('is_active', true);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: incomeEntries } = useQuery({
    queryKey: ['dashboard_income', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('income_entries')
        .select('id, receipt_number, receipt_date, total_amount, is_cancelled, member_id, flat_id, members(full_name), flats(flat_number)')
        .eq('society_id', currentSocietyId)
        .eq('is_cancelled', false)
        .order('receipt_date', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: expenseEntries } = useQuery({
    queryKey: ['dashboard_expenses', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('expense_entries')
        .select('id, voucher_number, voucher_date, net_amount, is_cancelled, vendor_name')
        .eq('society_id', currentSocietyId)
        .eq('is_cancelled', false)
        .order('voucher_date', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: complaints } = useQuery({
    queryKey: ['dashboard_complaints', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('complaints')
        .select('id, priority, status')
        .eq('society_id', currentSocietyId)
        .in('status', ['open', 'in_progress']);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: recentNotices } = useQuery({
    queryKey: ['dashboard_notices', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('notices')
        .select('id, title, notice_date')
        .eq('society_id', currentSocietyId)
        .order('notice_date', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const totalFlats = flats?.length || 0;
  const occupiedFlats = flats?.filter(f => f.status !== 'vacant').length || 0;
  const totalMembers = members?.length || 0;
  const totalActiveTenants = activeTenants?.length || 0;

  // For a live year this is "this month". For a closed year (an audited past
  // book) there is no current month inside it, so fall back to the most recent
  // month that has entries — otherwise the card just reads zero.
  const collectionMonth = (() => {
    const now = new Date();
    if (period.isCurrent) return { y: now.getFullYear(), m: now.getMonth() };
    const dates = (incomeEntries || [])
      .map(e => new Date(e.receipt_date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime());
    const d = dates[0] || new Date(period.end + 'T00:00:00');
    return { y: d.getFullYear(), m: d.getMonth() };
  })();

  const thisMonthIncome = incomeEntries
    ?.filter(e => {
      const d = new Date(e.receipt_date);
      return d.getMonth() === collectionMonth.m && d.getFullYear() === collectionMonth.y;
    })
    .reduce((sum, e) => sum + Number(e.total_amount), 0) || 0;

  const collectionMonthLabel = new Date(collectionMonth.y, collectionMonth.m, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const totalIncome = incomeEntries?.reduce((sum, e) => sum + Number(e.total_amount), 0) || 0;
  const totalExpenses = expenseEntries?.reduce((sum, e) => sum + Number(e.net_amount), 0) || 0;
  const activeComplaints = complaints?.length || 0;
  const highPriorityComplaints = complaints?.filter(c => c.priority === 'high').length || 0;

  const avgMaintenance = totalFlats > 0 && totalIncome > 0 ? totalIncome / (incomeEntries?.length || 1) : 5000;
  const collectionTarget = totalFlats * avgMaintenance;
  const collectionPercent = collectionTarget > 0 ? Math.min(Math.round((thisMonthIncome / collectionTarget) * 100), 100) : 0;

  const recentTransactions = [
    ...(incomeEntries?.slice(0, 5).map(e => ({
      id: e.id, flat: (e.flats as any)?.flat_number || '-',
      name: (e.members as any)?.full_name || 'Unknown',
      amount: Number(e.total_amount), date: e.receipt_date, type: 'income' as const,
    })) || []),
    ...(expenseEntries?.slice(0, 3).map(e => ({
      id: e.id, flat: '-', name: e.vendor_name,
      amount: Number(e.net_amount), date: e.voucher_date, type: 'expense' as const,
    })) || []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening at {currentSociety?.name || 'your society'} today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/reports')}>
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
          <Button size="sm" onClick={() => navigate('/income')}>
            <Plus className="h-4 w-4 mr-2" /> Record Income
          </Button>
        </div>
      </div>

      {/* Stats Grid - All clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Flats" value={totalFlats} subtitle={`${occupiedFlats} occupied`} icon={Building2} onClick={() => navigate('/flats')} />
        <StatCard title="Members" value={totalMembers} icon={Users} onClick={() => navigate('/members')} />
        <StatCard title="Tenants" value={totalActiveTenants} subtitle="Active" icon={UserCheck} onClick={() => navigate('/tenants')} />

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/income')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Collection
              <span className="ml-1 font-normal text-xs">({collectionMonthLabel})</span>
            </CardTitle>
            <div className="rounded-full bg-accent p-2"><TrendingUp className="h-4 w-4 text-accent-foreground" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(thisMonthIncome)}</div>
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{collectionPercent}%</span>
              </div>
              <Progress value={collectionPercent} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        <StatCard title="Expenses" value={formatCurrency(totalExpenses)} subtitle={`${expenseEntries?.length || 0} vouchers`} icon={TrendingDown} variant="destructive" onClick={() => navigate('/expenses')} />
        <StatCard title="Complaints" value={activeComplaints} subtitle={highPriorityComplaints > 0 ? `${highPriorityComplaints} high` : 'Under control'} icon={AlertCircle} variant="warning" onClick={() => navigate('/complaints')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start h-11" onClick={() => navigate('/income')}><Plus className="h-4 w-4 mr-3" />Record Income</Button>
            <Button variant="outline" className="w-full justify-start h-11" onClick={() => navigate('/expenses')}><Plus className="h-4 w-4 mr-3" />Add Expense</Button>
            <Button variant="outline" className="w-full justify-start h-11" onClick={() => navigate('/flats')}><Building2 className="h-4 w-4 mr-3" />Manage Flats</Button>
            <Button variant="outline" className="w-full justify-start h-11" onClick={() => navigate('/members')}><Users className="h-4 w-4 mr-3" />Members</Button>
            <Button variant="outline" className="w-full justify-start h-11" onClick={() => navigate('/notices')}><Bell className="h-4 w-4 mr-3" />Notices</Button>
          </CardContent>
        </Card>

        {/* Recent Transactions - clickable rows */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest income & expenses</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/income')}>View All</Button>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flat</TableHead>
                    <TableHead>Member/Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((txn) => (
                    <TableRow
                      key={txn.id}
                      className="cursor-pointer"
                      onClick={() => navigate(txn.type === 'income' ? '/income' : '/expenses')}
                    >
                      <TableCell className="font-medium">{txn.flat}</TableCell>
                      <TableCell>{txn.name}</TableCell>
                      <TableCell className="text-muted-foreground">{format(new Date(txn.date), 'dd MMM')}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={txn.type === 'income' ? 'secondary' : 'destructive'}
                          className={cn('font-mono', txn.type === 'income' && 'bg-primary/10 text-primary hover:bg-primary/20')}
                        >
                          {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Notices - clickable */}
      {recentNotices && recentNotices.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Notices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/notices')}>View All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentNotices.map(n => (
                <div key={n.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors" onClick={() => navigate('/notices')}>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{n.title}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{format(new Date(n.notice_date), 'dd MMM yyyy')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
