import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useAccess } from '@/hooks/useAccess';
import { useSocietyStore } from '@/stores/societyStore';
import { format } from 'date-fns';
import { Plus, TrendingUp, Eye, Download, MoreHorizontal, XCircle, IndianRupee, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { IncomeForm } from '@/components/income/IncomeForm';
import { ReceiptPreviewDialog } from '@/components/receipts/ReceiptPreviewDialog';
import { RegisterFilters } from '@/components/registers/RegisterFilters';
import { SortableHeader } from '@/components/registers/SortableHeader';
import { RegisterPagination } from '@/components/registers/RegisterPagination';
import { useRegisterFilters } from '@/hooks/useRegisterFilters';
import type { Database } from '@/integrations/supabase/db-types';

type IncomeEntry = Database['public']['Tables']['income_entries']['Row'] & {
  members?: Database['public']['Tables']['members']['Row'] | null;
  flats?: Database['public']['Tables']['flats']['Row'] | null;
  income_entry_details?: Array<{
    id: string;
    amount: number;
    income_heads?: { id: string; head_name: string } | null;
  }>;
};

const paymentModeLabels: Record<string, string> = {
  cash: 'Cash', cheque: 'Cheque', neft: 'NEFT', upi: 'UPI', card: 'Card',
};

export default function IncomePage() {
  const { currentSocietyId } = useAuthStore();
  const { can } = useAccess();
  const canCreate = can('income', 'create');
  // Cancelling a receipt reverses money that was already acknowledged to
  // a member, so it is an office-bearer action, not an entry-clerk one.
  const canCancel = can('income', 'delete');
  const { currentSociety } = useSocietyStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<any>(null);

  // Fetch income entries with details for categorization
  const { data: incomeEntries, isLoading } = useQuery({
    queryKey: ['income_entries', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('income_entries')
        .select(`*, members (*), flats (*), income_entry_details (*, income_heads (*))`)
        .eq('society_id', currentSocietyId)
        .order('receipt_date', { ascending: false });
      if (error) throw error;
      return (data || []) as IncomeEntry[];
    },
    enabled: !!currentSocietyId,
  });

  // Fetch income heads for category tabs
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

  // Get primary head for each entry (for categorization)
  const getPrimaryHead = useCallback((entry: IncomeEntry): string => {
    const details = entry.income_entry_details;
    if (!details || details.length === 0) return 'other';
    // Return the head with the largest amount
    const sorted = [...details].sort((a, b) => Number(b.amount) - Number(a.amount));
    return sorted[0]?.income_heads?.head_name?.toLowerCase() || 'other';
  }, []);

  // Build category tabs from income heads
  const categories = useMemo(() => {
    const cats = [{ key: 'all', label: 'All' }];
    if (incomeHeads) {
      incomeHeads.forEach(h => {
        cats.push({ key: h.head_name.toLowerCase(), label: h.head_name });
      });
    }
    return cats;
  }, [incomeHeads]);

  const searchFields = useCallback((entry: IncomeEntry) => [
    entry.receipt_number,
    entry.members?.full_name || '',
    entry.flats?.flat_number || '',
    entry.transaction_ref || '',
    String(entry.total_amount),
  ], []);

  const dateField = useCallback((entry: IncomeEntry) => entry.receipt_date, []);

  const categoryField = useCallback((entry: IncomeEntry) => getPrimaryHead(entry), [getPrimaryHead]);

  const filters = useRegisterFilters({
    data: incomeEntries,
    searchFields,
    dateField,
    categoryField,
  });

  // Apply sorting
  const sortedData = useMemo(() => {
    const data = [...filters.filtered];
    if (!filters.sortColumn || !filters.sortDirection) return data;
    const dir = filters.sortDirection === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      switch (filters.sortColumn) {
        case 'receipt_number': return a.receipt_number.localeCompare(b.receipt_number) * dir;
        case 'date': return (new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()) * dir;
        case 'member': return (a.members?.full_name || '').localeCompare(b.members?.full_name || '') * dir;
        case 'flat': return (a.flats?.flat_number || '').localeCompare(b.flats?.flat_number || '') * dir;
        case 'mode': return (a.payment_mode || '').localeCompare(b.payment_mode || '') * dir;
        case 'amount': return (Number(a.total_amount) - Number(b.total_amount)) * dir;
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
        .from('income_entries').update({ is_cancelled: true }).eq('id', entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_entries'] });
      toast({ title: 'Receipt cancelled successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleViewReceipt = async (entry: IncomeEntry) => {
    const breakdown = entry.income_entry_details?.map(d => ({
      head_name: (d.income_heads as any)?.head_name || 'Unknown',
      amount: Number(d.amount),
    })) || [{ head_name: 'Total Payment', amount: Number(entry.total_amount) }];

    setReceiptPreview({
      societyName: currentSociety?.name || 'Society',
      societyAddress: currentSociety?.address || undefined,
      societyRegNo: currentSociety?.registration_no || undefined,
      receiptNumber: entry.receipt_number,
      receiptDate: format(new Date(entry.receipt_date), 'dd/MM/yyyy'),
      memberName: entry.members?.full_name || 'N/A',
      flatNumber: entry.flats?.flat_number || 'N/A',
      paymentMode: entry.payment_mode || 'cash',
      transactionRef: entry.transaction_ref || undefined,
      periodFrom: entry.period_from ? format(new Date(entry.period_from), 'MMM yyyy') : undefined,
      periodTo: entry.period_to ? format(new Date(entry.period_to), 'MMM yyyy') : undefined,
      breakdown,
      totalAmount: Number(entry.total_amount),
      isCancelled: entry.is_cancelled || false,
    });
  };

  // Financial summaries
  const filteredActiveEntries = sortedData.filter(e => !e.is_cancelled);
  const filteredTotal = filteredActiveEntries.reduce((s, e) => s + Number(e.total_amount), 0);
  const totalCollection = incomeEntries?.filter(e => !e.is_cancelled).reduce((s, e) => s + Number(e.total_amount), 0) || 0;
  const totalReceipts = incomeEntries?.filter(e => !e.is_cancelled).length || 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Income Register</h1>
          <p className="text-muted-foreground">Record and manage maintenance collections</p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsFormOpen(true)} className="touch-target">
            <Plus className="mr-2 h-4 w-4" /> Record Income
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <IndianRupee className="h-5 w-5 text-primary" />
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
                <TrendingUp className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(totalCollection)}</p>
                <p className="text-xs text-muted-foreground">All-time Collection</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <TrendingUp className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalReceipts}</p>
                <p className="text-xs text-muted-foreground">Total Receipts</p>
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
            searchPlaceholder="Search receipt no, member, flat, reference..."
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
          <CardTitle className="text-base">Income Register</CardTitle>
          <CardDescription>{sortedData.length} entries | Filtered: {formatCurrency(filteredTotal)}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sortedData.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No income entries found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or record your first income entry</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader label="Receipt No." column="receipt_number" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Date" column="date" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Member" column="member" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Flat" column="flat" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Mode" column="mode" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} />
                      <SortableHeader label="Amount" column="amount" currentColumn={filters.sortColumn} direction={filters.sortDirection} onSort={filters.handleSort} className="text-right" />
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm">Actions</th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((entry) => (
                      <TableRow key={entry.id} className={entry.is_cancelled ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {entry.receipt_number}
                            {entry.is_cancelled && <Badge variant="destructive" className="text-xs">Cancelled</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(entry.receipt_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{entry.members?.full_name || '-'}</TableCell>
                        <TableCell>{entry.flats?.flat_number || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{paymentModeLabels[entry.payment_mode || ''] || entry.payment_mode}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(Number(entry.total_amount))}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewReceipt(entry)}>
                                <Eye className="mr-2 h-4 w-4" />View Receipt
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewReceipt(entry)}>
                                <Download className="mr-2 h-4 w-4" />Download PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewReceipt(entry)}>
                                <Printer className="mr-2 h-4 w-4" />Print Receipt
                              </DropdownMenuItem>
                              {canCancel && !entry.is_cancelled && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => cancelMutation.mutate(entry.id)} className="text-destructive">
                                    <XCircle className="mr-2 h-4 w-4" />Cancel Receipt
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
                        <div className="cursor-pointer" onClick={() => handleViewReceipt(entry)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{entry.receipt_number}</span>
                            {entry.is_cancelled && <Badge variant="destructive" className="text-xs">Cancelled</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entry.members?.full_name} • {entry.flats?.flat_number}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewReceipt(entry)}>
                              <Eye className="mr-2 h-4 w-4" />View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewReceipt(entry)}>
                              <Download className="mr-2 h-4 w-4" />Download
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
                            {format(new Date(entry.receipt_date), 'dd MMM yyyy')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {paymentModeLabels[entry.payment_mode || ''] || entry.payment_mode}
                          </Badge>
                        </div>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(Number(entry.total_amount))}
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

      {/* Add Income Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Income</DialogTitle>
            <DialogDescription>Enter payment details and breakdown by income heads</DialogDescription>
          </DialogHeader>
          <IncomeForm onClose={() => setIsFormOpen(false)} prefill={undefined} />
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <ReceiptPreviewDialog
        open={!!receiptPreview}
        onOpenChange={(open) => !open && setReceiptPreview(null)}
        data={receiptPreview}
      />
    </div>
  );
}
