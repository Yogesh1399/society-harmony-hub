import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useAccess } from '@/hooks/useAccess';
import { useSocietyStore } from '@/stores/societyStore';
import { format } from 'date-fns';
import { Plus, TrendingDown, Eye, Download, MoreHorizontal, XCircle, IndianRupee, Printer, Clock } from 'lucide-react';
import { ApprovalHistoryDialog } from '@/components/expenses/ApprovalHistoryDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { ReceiptPreviewDialog } from '@/components/receipts/ReceiptPreviewDialog';
import { RegisterFilters } from '@/components/registers/RegisterFilters';
import { SortableHeader } from '@/components/registers/SortableHeader';
import { RegisterPagination } from '@/components/registers/RegisterPagination';
import { useRegisterFilters } from '@/hooks/useRegisterFilters';
import type { Database } from '@/integrations/supabase/db-types';

type ExpenseEntry = Database['public']['Tables']['expense_entries']['Row'] & {
  expense_heads?: Database['public']['Tables']['expense_heads']['Row'] | null;
};

const paymentModeLabels: Record<string, string> = {
  cash: 'Cash', cheque: 'Cheque', neft: 'NEFT', upi: 'UPI', card: 'Card',
};

export default function ExpensePage() {
  const { currentSocietyId } = useAuthStore();
  const { can } = useAccess();
  const canCreate = can('expenses', 'create');
  // Cancelling a voucher undoes a payment the society has already
  // recorded against a vendor. Office bearers only.
  const canCancel = can('expenses', 'delete');
  const { currentSociety } = useSocietyStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [voucherPreview, setVoucherPreview] = useState<any>(null);
  const [historyEntry, setHistoryEntry] = useState<{ id: string; voucher_number: string } | null>(null);

  const { data: expenseEntries, isLoading } = useQuery({
    queryKey: ['expense_entries', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('expense_entries')
        .select(`*, expense_heads (*)`)
        .eq('society_id', currentSocietyId)
        .order('voucher_date', { ascending: false });
      if (error) throw error;
      return (data || []) as ExpenseEntry[];
    },
    enabled: !!currentSocietyId,
  });

  const { data: expenseHeads } = useQuery({
    queryKey: ['expense_heads', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('expense_heads').select('*').eq('society_id', currentSocietyId).eq('is_active', true).order('head_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const categories = useMemo(() => {
    const cats = [{ key: 'all', label: 'All' }];
    if (expenseHeads) {
      expenseHeads.forEach(h => {
        cats.push({ key: h.head_name.toLowerCase(), label: h.head_name });
      });
    }
    return cats;
  }, [expenseHeads]);

  const searchFields = useCallback((entry: ExpenseEntry) => [
    entry.voucher_number,
    entry.vendor_name,
    entry.expense_heads?.head_name || '',
    String(entry.net_amount),
    entry.description || '',
  ], []);

  const dateField = useCallback((entry: ExpenseEntry) => entry.voucher_date, []);
  const categoryField = useCallback((entry: ExpenseEntry) => entry.expense_heads?.head_name?.toLowerCase() || 'other', []);

  const filters = useRegisterFilters({
    data: expenseEntries,
    searchFields,
    dateField,
    categoryField,
  });

  const sortedData = useMemo(() => {
    const data = [...filters.filtered];
    if (!filters.sortColumn || !filters.sortDirection) return data;
    const dir = filters.sortDirection === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      switch (filters.sortColumn) {
        case 'voucher_number': return a.voucher_number.localeCompare(b.voucher_number) * dir;
        case 'date': return (new Date(a.voucher_date).getTime() - new Date(b.voucher_date).getTime()) * dir;
        case 'head': return (a.expense_heads?.head_name || '').localeCompare(b.expense_heads?.head_name || '') * dir;
        case 'vendor': return a.vendor_name.localeCompare(b.vendor_name) * dir;
        case 'mode': return (a.payment_mode || '').localeCompare(b.payment_mode || '') * dir;
        case 'amount': return (Number(a.net_amount) - Number(b.net_amount)) * dir;
        default: return 0;
      }
    });
    return data;
  }, [filters.filtered, filters.sortColumn, filters.sortDirection]);

  const paginatedData = sortedData.slice(
    (filters.currentPage - 1) * filters.pageSize,
    filters.currentPage * filters.pageSize
  );
  const totalPages = Math.max(1, Math.ceil(sortedData.length / filters.pageSize));

  const cancelMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('expense_entries').update({ is_cancelled: true }).eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_entries'] });
      toast({ title: 'Voucher cancelled successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleViewVoucher = (entry: ExpenseEntry) => {
    setVoucherPreview({
      societyName: currentSociety?.name || 'Society',
      societyAddress: currentSociety?.address || undefined,
      societyRegNo: currentSociety?.registration_no || undefined,
      receiptNumber: entry.voucher_number,
      receiptDate: format(new Date(entry.voucher_date), 'dd/MM/yyyy'),
      memberName: entry.vendor_name,
      flatNumber: entry.vendor_address || '-',
      paymentMode: entry.payment_mode || 'neft',
      transactionRef: entry.transaction_ref || undefined,
      breakdown: [
        { head_name: entry.expense_heads?.head_name || 'Expense', amount: Number(entry.amount) },
        ...(Number(entry.gst_amount) > 0 ? [{ head_name: 'GST', amount: Number(entry.gst_amount) }] : []),
        ...(Number(entry.tds_amount) > 0 ? [{ head_name: 'TDS (Deducted)', amount: -Number(entry.tds_amount) }] : []),
      ],
      totalAmount: Number(entry.net_amount),
      isCancelled: entry.is_cancelled || false,
      receiptTitle: 'Expense Voucher',
    });
  };

  const filteredActiveEntries = sortedData.filter(e => !e.is_cancelled);
  const filteredTotal = filteredActiveEntries.reduce((s, e) => s + Number(e.net_amount), 0);
  const totalExpenses = expenseEntries?.filter(e => !e.is_cancelled).reduce((s, e) => s + Number(e.net_amount), 0) || 0;
  const totalVouchers = expenseEntries?.filter(e => !e.is_cancelled).length || 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Register</h1>
          <p className="text-muted-foreground">Record and manage society expenses</p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsFormOpen(true)} className="touch-target">
            <Plus className="mr-2 h-4 w-4" /> Record Expense
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <IndianRupee className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(filteredTotal)}</p>
                <p className="text-xs text-muted-foreground">Filtered Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <TrendingDown className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">All-time Expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <TrendingDown className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalVouchers}</p>
                <p className="text-xs text-muted-foreground">Total Vouchers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <RegisterFilters
            searchQuery={filters.searchQuery}
            setSearchQuery={filters.setSearchQuery}
            searchPlaceholder="Search voucher no, vendor, head, amount..."
            categories={categories}
            activeCategory={filters.activeCategory}
            setActiveCategory={(c) => { filters.setActiveCategory(c); filters.setCurrentPage(1); }}
            dateFilterMode={filters.dateFilterMode}
            setDateFilterMode={filters.setDateFilterMode}
            selectedMonth={filters.selectedMonth}
            setSelectedMonth={(m) => { filters.setSelectedMonth(m); filters.setCurrentPage(1); }}
            selectedYear={filters.selectedYear}
            setSelectedYear={(y) => { filters.setSelectedYear(y); filters.setCurrentPage(1); }}
            dateFrom={filters.dateFrom}
            setDateFrom={filters.setDateFrom}
            dateTo={filters.dateTo}
            setDateTo={filters.setDateTo}
          />
        </CardContent>
      </Card>

      {/* Register Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Expense Register</CardTitle>
          <CardDescription>{sortedData.length} entries | Filtered: {formatCurrency(filteredTotal)}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sortedData.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No expense entries found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or record your first expense</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader label="Voucher No." column="voucher_number" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Date" column="date" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Vendor" column="vendor" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Head" column="head" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Mode" column="mode" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Amount" column="amount" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} className="text-right" />
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">Status</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm">Actions</th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((entry) => (
                      <TableRow key={entry.id} className={entry.is_cancelled ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {entry.voucher_number}
                            {entry.is_cancelled && <Badge variant="destructive" className="text-xs">Cancelled</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(entry.voucher_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{entry.vendor_name}</TableCell>
                        <TableCell>{entry.expense_heads?.head_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{paymentModeLabels[entry.payment_mode || ''] || entry.payment_mode || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(Number(entry.net_amount))}</TableCell>
                        <TableCell>
                          {(() => {
                            const s = (entry as any).approval_status as string | undefined;
                            if (!s || s === 'approved') return <Badge variant="default" className="text-xs">Approved</Badge>;
                            if (s === 'pending_secretary') return <Badge variant="secondary" className="text-xs">Pending Secretary</Badge>;
                            if (s === 'pending_chairman') return <Badge variant="secondary" className="text-xs">Pending Chairman</Badge>;
                            if (s === 'rejected') return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
                            return <Badge variant="outline" className="text-xs">{s}</Badge>;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewVoucher(entry)}>
                                <Eye className="mr-2 h-4 w-4" />View Voucher
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewVoucher(entry)}>
                                <Download className="mr-2 h-4 w-4" />Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewVoucher(entry)}>
                                <Printer className="mr-2 h-4 w-4" />Print Voucher
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setHistoryEntry({ id: entry.id, voucher_number: entry.voucher_number })}>
                                <Clock className="mr-2 h-4 w-4" />Approval History
                              </DropdownMenuItem>
                              {canCancel && !entry.is_cancelled && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => cancelMutation.mutate(entry.id)} className="text-destructive">
                                    <XCircle className="mr-2 h-4 w-4" />Cancel Voucher
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {paginatedData.map((entry) => (
                  <Card key={entry.id} className={entry.is_cancelled ? 'opacity-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="cursor-pointer" onClick={() => handleViewVoucher(entry)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{entry.voucher_number}</span>
                            {entry.is_cancelled && <Badge variant="destructive" className="text-xs">Cancelled</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{entry.vendor_name}</p>
                          <p className="text-xs text-muted-foreground">{entry.expense_heads?.head_name}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewVoucher(entry)}>
                              <Eye className="mr-2 h-4 w-4" />View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewVoucher(entry)}>
                              <Download className="mr-2 h-4 w-4" />Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setHistoryEntry({ id: entry.id, voucher_number: entry.voucher_number })}>
                              <Clock className="mr-2 h-4 w-4" />Approval History
                            </DropdownMenuItem>
                            {canCancel && !entry.is_cancelled && (
                              <DropdownMenuItem onClick={() => cancelMutation.mutate(entry.id)} className="text-destructive">
                                <XCircle className="mr-2 h-4 w-4" />Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.voucher_date), 'dd MMM yyyy')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {paymentModeLabels[entry.payment_mode || ''] || entry.payment_mode || '-'}
                          </Badge>
                        </div>
                        <span className="text-lg font-bold text-destructive">
                          {formatCurrency(Number(entry.net_amount))}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              <RegisterPagination
                currentPage={filters.currentPage}
                totalPages={totalPages}
                onPageChange={filters.setCurrentPage}
                totalItems={sortedData.length}
                pageSize={filters.pageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
            <DialogDescription>Enter expense details with GST/TDS calculations</DialogDescription>
          </DialogHeader>
          <ExpenseForm onClose={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Voucher Preview Dialog */}
      <ReceiptPreviewDialog
        open={!!voucherPreview}
        onOpenChange={(open) => !open && setVoucherPreview(null)}
        data={voucherPreview}
      />

      {/* Approval History Dialog */}
      <ApprovalHistoryDialog
        open={!!historyEntry}
        onOpenChange={(o) => !o && setHistoryEntry(null)}
        expenseId={historyEntry?.id ?? null}
        voucherNumber={historyEntry?.voucher_number}
      />
    </div>
  );
}
