import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import {
  Calendar, Plus, Lock, Unlock, CheckCircle2, AlertTriangle,
  ChevronRight, FileText, Settings2, RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { YearEndWizard } from './YearEndWizard';

const FORMAT_OPTIONS = [
  { value: '{YEAR}-{TYPE}-{NUM}', label: '2526-MNT-00001', desc: 'Year-Type-Number' },
  { value: '{TYPE}-{YEAR}-{NUM}', label: 'MNT-2526-00001', desc: 'Type-Year-Number' },
  { value: '{NUM}-{YEAR}-{TYPE}', label: '00001-2526-MNT', desc: 'Number-Year-Type' },
  { value: '{TYPE}/{YEAR}/{NUM}', label: 'MNT/2526/00001', desc: 'Type/Year/Number' },
];

export function FiscalYearSettings() {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showYearEndWizard, setShowYearEndWizard] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);

  const { data: fiscalYears, isLoading } = useQuery({
    queryKey: ['fiscal_years', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .eq('society_id', currentSocietyId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: fiscalMonths } = useQuery({
    queryKey: ['fiscal_months', currentSocietyId, selectedYearId],
    queryFn: async () => {
      if (!currentSocietyId || !selectedYearId) return [];
      const { data, error } = await supabase
        .from('fiscal_months')
        .select('*')
        .eq('fiscal_year_id', selectedYearId)
        .eq('society_id', currentSocietyId)
        .order('month_number');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId && !!selectedYearId,
  });

  const { data: docSeries } = useQuery({
    queryKey: ['document_series', currentSocietyId, selectedYearId],
    queryFn: async () => {
      if (!currentSocietyId || !selectedYearId) return [];
      const { data, error } = await supabase
        .from('document_series')
        .select('*')
        .eq('fiscal_year_id', selectedYearId)
        .eq('society_id', currentSocietyId)
        .order('doc_type');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId && !!selectedYearId,
  });

  const { data: society } = useQuery({
    queryKey: ['society_doc_format', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return null;
      const { data } = await supabase
        .from('societies')
        .select('document_number_format, auto_close_month_day')
        .eq('id', currentSocietyId)
        .single();
      return data;
    },
    enabled: !!currentSocietyId,
  });

  // Auto-select the latest fiscal year
  const activeYear = fiscalYears?.find(fy => fy.status === 'open') || fiscalYears?.[0];
  const effectiveSelectedYear = selectedYearId || activeYear?.id || null;
  if (activeYear && !selectedYearId && fiscalYears && fiscalYears.length > 0) {
    // Use setTimeout to avoid setState during render
    setTimeout(() => setSelectedYearId(activeYear.id), 0);
  }

  const toggleMonthMutation = useMutation({
    mutationFn: async ({ monthId, newStatus }: { monthId: string; newStatus: string }) => {
      const updates: any = { status: newStatus };
      if (newStatus === 'closed') {
        updates.closed_at = new Date().toISOString();
      } else {
        updates.closed_at = null;
        updates.closed_by = null;
      }
      const { error } = await supabase.from('fiscal_months').update(updates).eq('id', monthId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal_months'] });
      toast({ title: 'Month status updated' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateFormatMutation = useMutation({
    mutationFn: async (format: string) => {
      if (!currentSocietyId) throw new Error('No society');
      const { error } = await supabase.from('societies').update({ document_number_format: format }).eq('id', currentSocietyId);
      if (error) throw error;
      // Also update all series in the active year
      if (selectedYearId) {
        const { error: seriesError } = await supabase
          .from('document_series')
          .update({ format_pattern: format })
          .eq('society_id', currentSocietyId)
          .eq('fiscal_year_id', selectedYearId);
        if (seriesError) throw seriesError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['society_doc_format'] });
      queryClient.invalidateQueries({ queryKey: ['document_series'] });
      toast({ title: 'Document format updated' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateAutoCloseMutation = useMutation({
    mutationFn: async (day: number | null) => {
      if (!currentSocietyId) throw new Error('No society');
      const { error } = await supabase.from('societies').update({ auto_close_month_day: day }).eq('id', currentSocietyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['society_doc_format'] });
      toast({ title: 'Auto-close setting updated' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const createFiscalYearMutation = useMutation({
    mutationFn: async () => {
      if (!currentSocietyId) throw new Error('No society');
      // Determine next fiscal year
      const latestYear = fiscalYears?.[0];
      let startYear: number;
      if (latestYear) {
        startYear = parseInt(latestYear.year_code.slice(2)) + 2000;
      } else {
        const now = new Date();
        startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      }
      const endYear = startYear + 1;
      const yearCode = String(startYear).slice(2) + String(endYear).slice(2);
      const yearLabel = `${startYear}-${String(endYear).slice(2)}`;
      const startDate = `${startYear}-04-01`;
      const endDate = `${endYear}-03-31`;
      const format = society?.document_number_format || '{YEAR}-{TYPE}-{NUM}';

      // Create fiscal year
      const { data: fy, error: fyErr } = await supabase
        .from('fiscal_years')
        .insert({ society_id: currentSocietyId, year_code: yearCode, year_label: yearLabel, start_date: startDate, end_date: endDate })
        .select()
        .single();
      if (fyErr) throw fyErr;

      // Create 12 months
      const months = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(startYear, 3 + i, 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        months.push({
          fiscal_year_id: fy.id,
          society_id: currentSocietyId,
          month_number: i + 1,
          month_label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          month_start: d.toISOString().split('T')[0],
          month_end: monthEnd.toISOString().split('T')[0],
        });
      }
      const { error: mErr } = await supabase.from('fiscal_months').insert(months);
      if (mErr) throw mErr;

      // Create document series
      const docTypes = [
        { doc_type: 'income', type_code: 'RCP' },
        { doc_type: 'expense', type_code: 'VCH' },
        { doc_type: 'maintenance', type_code: 'MNT' },
        { doc_type: 'notice', type_code: 'NTC' },
        { doc_type: 'complaint', type_code: 'CMP' },
        { doc_type: 'debit_note', type_code: 'DBN' },
        { doc_type: 'credit_note', type_code: 'CRN' },
      ];
      const series = docTypes.map(dt => ({
        society_id: currentSocietyId,
        fiscal_year_id: fy.id,
        ...dt,
        format_pattern: format,
      }));
      const { error: sErr } = await supabase.from('document_series').insert(series);
      if (sErr) throw sErr;

      return fy;
    },
    onSuccess: (fy) => {
      queryClient.invalidateQueries({ queryKey: ['fiscal_years'] });
      setSelectedYearId(fy.id);
      setShowCreateDialog(false);
      toast({ title: 'New fiscal year created', description: `${fy.year_label} is now active` });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-primary/10 text-primary border-primary/20">Open</Badge>;
      case 'closed': return <Badge variant="secondary">Closed</Badge>;
      case 'finalized': return <Badge className="bg-accent/50 text-accent-foreground border-accent/30">Finalized</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Fiscal Years Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Fiscal Years</CardTitle>
              <CardDescription>Manage accounting periods and year-end processes</CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> New Fiscal Year
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(!fiscalYears || fiscalYears.length === 0) ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No fiscal years configured</h3>
              <p className="text-muted-foreground mb-4">Create your first fiscal year to start managing accounting periods</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Fiscal Year
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {fiscalYears.map(fy => (
                <div
                  key={fy.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedYearId === fy.id ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'}`}
                  onClick={() => setSelectedYearId(fy.id)}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">FY {fy.year_label}</p>
                      <p className="text-xs text-muted-foreground">{fy.start_date} to {fy.end_date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(fy.status)}
                    {fy.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedYearId(fy.id); setShowYearEndWizard(true); }}
                      >
                        Year End
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Month Management */}
      {selectedYearId && fiscalMonths && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-4 w-4" /> Period Management — FY {fiscalYears?.find(f => f.id === selectedYearId)?.year_label}
            </CardTitle>
            <CardDescription>Open or close months to control data entry for each period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fiscalMonths.map(month => {
                const isClosed = month.status === 'closed';
                const yearFinalized = fiscalYears?.find(f => f.id === selectedYearId)?.status === 'finalized';
                return (
                  <div key={month.id} className={`flex items-center justify-between p-3 rounded-lg border ${isClosed ? 'bg-muted/30' : 'bg-background'}`}>
                    <div className="flex items-center gap-2">
                      {isClosed ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Unlock className="h-4 w-4 text-primary" />}
                      <div>
                        <p className="font-medium text-sm">{month.month_label}</p>
                        <p className="text-xs text-muted-foreground">{isClosed ? 'Locked' : 'Open'}</p>
                      </div>
                    </div>
                    <Switch
                      checked={!isClosed}
                      disabled={yearFinalized}
                      onCheckedChange={(checked) => toggleMonthMutation.mutate({ monthId: month.id, newStatus: checked ? 'open' : 'closed' })}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Numbering Format */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Settings2 className="h-4 w-4" /> Document Numbering</CardTitle>
          <CardDescription>Choose the format for all auto-generated document numbers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Number Format</Label>
            <Select
              value={society?.document_number_format || '{YEAR}-{TYPE}-{NUM}'}
              onValueChange={(val) => updateFormatMutation.mutate(val)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="font-mono text-sm">{opt.label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">({opt.desc})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Auto-Close Month (Day of Next Month)</Label>
            <div className="flex items-center gap-3 mt-1">
              <Select
                value={society?.auto_close_month_day?.toString() || 'off'}
                onValueChange={(val) => updateAutoCloseMutation.mutate(val === 'off' ? null : parseInt(val))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Disabled" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Disabled (Manual)</SelectItem>
                  <SelectItem value="1">1st of next month</SelectItem>
                  <SelectItem value="5">5th of next month</SelectItem>
                  <SelectItem value="10">10th of next month</SelectItem>
                  <SelectItem value="15">15th of next month</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Previous month auto-closes on this day</p>
            </div>
          </div>

          {/* Current Series Status */}
          {docSeries && docSeries.length > 0 && (
            <div className="mt-4">
              <Label className="mb-2 block">Document Series (Current Year)</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead className="text-right">Last #</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docSeries.map(ds => (
                    <TableRow key={ds.id}>
                      <TableCell className="capitalize">{ds.doc_type.replace('_', ' ')}</TableCell>
                      <TableCell className="font-mono">{ds.type_code}</TableCell>
                      <TableCell className="font-mono text-xs">{ds.format_pattern}</TableCell>
                      <TableCell className="text-right">{ds.current_number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Fiscal Year Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Fiscal Year</DialogTitle>
            <DialogDescription>
              This will create a new fiscal year with 12 monthly periods and auto-generate document numbering series for all document types. All series will start from number 1.
            </DialogDescription>
          </DialogHeader>
          {fiscalYears && fiscalYears.length > 0 && (
            <div className="py-2">
              <p className="text-sm text-muted-foreground">
                Latest year: <strong>FY {fiscalYears[0].year_label}</strong> ({fiscalYears[0].status})
              </p>
              {fiscalYears[0].status === 'open' && (
                <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                  <p className="text-sm text-warning">The current year is still open. You can create the next year, but consider completing the year-end process first.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={() => createFiscalYearMutation.mutate()} disabled={createFiscalYearMutation.isPending}>
              {createFiscalYearMutation.isPending ? 'Creating...' : 'Create Fiscal Year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Year End Wizard */}
      {showYearEndWizard && selectedYearId && (
        <YearEndWizard
          fiscalYearId={selectedYearId}
          onClose={() => setShowYearEndWizard(false)}
        />
      )}
    </div>
  );
}
