import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { downloadTemplate, parseExcelFile } from '@/lib/excelExport';

type MembersBulkUploadProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

interface ParsedRow {
  full_name: string;
  flat_number: string;
  wing?: string;
  mobile?: string;
  email?: string;
  aadhar_last4?: string;
  pan_last4?: string;
  __row: number;
  __errors: string[];
  __ok: boolean;
}

const TEMPLATE_HEADERS = ['full_name', 'flat_number', 'wing', 'mobile', 'email', 'aadhar_last4', 'pan_last4'];

export function MembersBulkUpload({ open, onOpenChange }: MembersBulkUploadProps) {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  // Pre-load existing flats so we can resolve flat_id by flat_number+wing
  const { data: flats } = useQuery({
    queryKey: ['bulk_upload_flats', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('flats')
        .select('id, flat_number, wing')
        .eq('society_id', currentSocietyId);
      return data || [];
    },
    enabled: !!currentSocietyId && open,
  });

  // Pre-load existing members to detect duplicates
  const { data: existingMembers } = useQuery({
    queryKey: ['bulk_upload_existing_members', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase
        .from('members')
        .select('id, flat_id, mobile, email')
        .eq('society_id', currentSocietyId);
      return data || [];
    },
    enabled: !!currentSocietyId && open,
  });

  const handleDownloadTemplate = () => {
    downloadTemplate('members-template', TEMPLATE_HEADERS, {
      full_name: 'John Doe',
      flat_number: '101',
      wing: 'A',
      mobile: '9876543210',
      email: 'john@example.com',
      aadhar_last4: '1234',
      pan_last4: 'AB12',
    });
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const rows = await parseExcelFile<Record<string, any>>(file);
      const parsed: ParsedRow[] = rows.map((r, idx) => {
        const errors: string[] = [];
        const full_name = String(r.full_name || '').trim();
        const flat_number = String(r.flat_number || '').trim();
        const wing = String(r.wing || '').trim() || undefined;
        const mobile = r.mobile ? String(r.mobile).trim() : undefined;
        const email = r.email ? String(r.email).trim() : undefined;
        const aadhar_last4 = r.aadhar_last4 ? String(r.aadhar_last4).trim().slice(-4) : undefined;
        const pan_last4 = r.pan_last4 ? String(r.pan_last4).trim() : undefined;

        if (!full_name) errors.push('full_name required');
        if (!flat_number) errors.push('flat_number required');
        if (mobile && !/^[0-9+\-\s]{7,15}$/.test(mobile)) errors.push('invalid mobile');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('invalid email');

        // Match flat
        const matchedFlat = flats?.find(f =>
          f.flat_number?.toLowerCase() === flat_number.toLowerCase() &&
          (wing ? (f.wing || '').toLowerCase() === wing.toLowerCase() : true)
        );
        if (!matchedFlat) errors.push(`flat ${wing ? wing + '-' : ''}${flat_number} not found`);
        else {
          // Check duplicate (already a member assigned to this flat with same mobile/email)
          const dup = existingMembers?.find(m =>
            m.flat_id === matchedFlat.id && (
              (mobile && m.mobile === mobile) ||
              (email && m.email === email)
            )
          );
          if (dup) errors.push('member already exists for this flat');
        }

        return {
          full_name, flat_number, wing, mobile, email, aadhar_last4, pan_last4,
          __row: idx + 2, // header row = 1
          __errors: errors,
          __ok: errors.length === 0,
        };
      });
      setParsedRows(parsed);
    } catch (e: any) {
      toast({ title: 'Failed to parse file', description: e.message, variant: 'destructive' });
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!currentSocietyId) throw new Error('No society selected');
      const validRows = parsedRows.filter(r => r.__ok);

      const payloads = validRows.map(r => {
        const flat = flats?.find(f =>
          f.flat_number?.toLowerCase() === r.flat_number.toLowerCase() &&
          (r.wing ? (f.wing || '').toLowerCase() === r.wing.toLowerCase() : true)
        );
        return {
          society_id: currentSocietyId,
          flat_id: flat?.id || null,
          full_name: r.full_name,
          mobile: r.mobile || null,
          email: r.email || null,
          aadhar_masked: r.aadhar_last4 || null,
          pan_masked: r.pan_last4 || null,
          is_active: true,
        };
      });

      // Insert in batches of 100
      let inserted = 0;
      const errors: string[] = [];
      for (let i = 0; i < payloads.length; i += 100) {
        const batch = payloads.slice(i, i + 100);
        const { error, count } = await supabase.from('members').insert(batch, { count: 'exact' });
        if (error) {
          errors.push(`Batch ${Math.floor(i / 100) + 1}: ${error.message}`);
        } else {
          inserted += count || batch.length;
        }
      }

      // Best-effort log entry
      try {
        await supabase.from('bulk_upload_logs').insert({
          society_id: currentSocietyId,
          upload_type: 'members',
          file_name: fileName,
          total_rows: parsedRows.length,
          success_rows: inserted,
          failed_rows: parsedRows.length - inserted,
          error_details: errors.length ? { errors } : null,
        } as any);
      } catch { /* table may not exist; ignore */ }

      return { success: inserted, failed: parsedRows.length - inserted, errors };
    },
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast({
        title: 'Bulk upload complete',
        description: `${res.success} added, ${res.failed} failed.`,
      });
    },
    onError: (e: any) => {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    },
  });

  const validCount = parsedRows.filter(r => r.__ok).length;
  const invalidCount = parsedRows.length - validCount;

  const handleClose = () => {
    setParsedRows([]);
    setFileName('');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Bulk Upload Members</DialogTitle>
          <DialogDescription>
            Download the template, fill in member details, then upload the file to import multiple members at once.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Step 1: download template */}
          <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Step 1: Download template</p>
              <p className="text-sm text-muted-foreground">Excel file with required columns and a sample row.</p>
            </div>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
          </div>

          {/* Step 2: upload file */}
          <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Step 2: Upload filled file</p>
              <p className="text-sm text-muted-foreground">{fileName ? fileName : 'No file selected'}</p>
            </div>
            <label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
              <Button asChild variant="outline">
                <span><Upload className="mr-2 h-4 w-4" /> Choose File</span>
              </Button>
            </label>
          </div>

          {/* Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> {validCount} valid</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> {invalidCount} with errors</Badge>
                )}
                <span className="text-sm text-muted-foreground">{parsedRows.length} total rows</span>
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Flat</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map(r => (
                      <TableRow key={r.__row} className={r.__ok ? '' : 'bg-destructive/5'}>
                        <TableCell className="font-mono text-xs">{r.__row}</TableCell>
                        <TableCell>
                          {r.__ok
                            ? <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> OK</Badge>
                            : <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>}
                        </TableCell>
                        <TableCell>{r.full_name || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{r.wing ? `${r.wing}-` : ''}{r.flat_number}</TableCell>
                        <TableCell>{r.mobile || '—'}</TableCell>
                        <TableCell>{r.email || '—'}</TableCell>
                        <TableCell className="text-destructive text-xs">{r.__errors.join('; ')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Result summary */}
          {result && (
            <Alert variant={result.failed > 0 ? 'destructive' : 'default'}>
              <AlertTitle>Upload complete</AlertTitle>
              <AlertDescription>
                {result.success} member(s) imported successfully. {result.failed > 0 && `${result.failed} failed.`}
                {result.errors.length > 0 && (
                  <ul className="list-disc pl-5 mt-2 text-xs">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button
            disabled={!validCount || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {validCount} valid row{validCount === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
