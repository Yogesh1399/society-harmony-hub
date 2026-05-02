import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import {
  CheckCircle2, AlertTriangle, Lock, Upload, FileCheck, ChevronRight, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface YearEndWizardProps {
  fiscalYearId: string;
  onClose: () => void;
}

type WizardStep = 'months' | 'transactions' | 'audit' | 'finalize';

export function YearEndWizard({ fiscalYearId, onClose }: YearEndWizardProps) {
  const { currentSocietyId, user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<WizardStep>('months');
  const [auditDocUrl, setAuditDocUrl] = useState('');

  const { data: fiscalYear } = useQuery({
    queryKey: ['fiscal_year_detail', fiscalYearId],
    queryFn: async () => {
      const { data, error } = await supabase.from('fiscal_years').select('*').eq('id', fiscalYearId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: months } = useQuery({
    queryKey: ['fiscal_months_wizard', fiscalYearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiscal_months')
        .select('*')
        .eq('fiscal_year_id', fiscalYearId)
        .order('month_number');
      if (error) throw error;
      return data || [];
    },
  });

  // Check for pending transactions in the fiscal year
  const { data: pendingChecks } = useQuery({
    queryKey: ['pending_transactions_check', fiscalYearId, currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId || !fiscalYear) return { pendingBills: 0, cancelledReceipts: 0 };
      
      // Check pending maintenance bills
      const { count: pendingBills } = await supabase
        .from('maintenance_bills')
        .select('*', { count: 'exact', head: true })
        .eq('society_id', currentSocietyId)
        .eq('status', 'pending')
        .gte('bill_date', fiscalYear.start_date)
        .lte('bill_date', fiscalYear.end_date);

      return {
        pendingBills: pendingBills || 0,
      };
    },
    enabled: !!currentSocietyId && !!fiscalYear,
  });

  const openMonths = months?.filter(m => m.status === 'open') || [];
  const allMonthsClosed = openMonths.length === 0;

  const closeMonthMutation = useMutation({
    mutationFn: async (monthId: string) => {
      const { error } = await supabase
        .from('fiscal_months')
        .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user?.id })
        .eq('id', monthId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal_months_wizard'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal_months'] });
      toast({ title: 'Month closed' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const closeAllMonthsMutation = useMutation({
    mutationFn: async () => {
      const openIds = openMonths.map(m => m.id);
      for (const id of openIds) {
        const { error } = await supabase
          .from('fiscal_months')
          .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: user?.id })
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal_months_wizard'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal_months'] });
      toast({ title: 'All months closed' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const finalizeYearMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('fiscal_years')
        .update({
          status: 'finalized',
          audit_document_url: auditDocUrl || null,
          finalized_at: new Date().toISOString(),
          finalized_by: user.id,
        })
        .eq('id', fiscalYearId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal_years'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal_year_detail'] });
      toast({ title: 'Year finalized', description: 'The fiscal year has been closed and locked. No further entries can be made.' });
      onClose();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const steps: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
    { key: 'months', label: 'Close Months', icon: <Lock className="h-4 w-4" /> },
    { key: 'transactions', label: 'Review Transactions', icon: <AlertTriangle className="h-4 w-4" /> },
    { key: 'audit', label: 'Audit Document', icon: <Upload className="h-4 w-4" /> },
    { key: 'finalize', label: 'Finalize', icon: <FileCheck className="h-4 w-4" /> },
  ];

  const stepIndex = steps.findIndex(s => s.key === currentStep);

  const canProceed = () => {
    switch (currentStep) {
      case 'months': return allMonthsClosed;
      case 'transactions': return true; // warnings only, can proceed
      case 'audit': return true; // audit doc is optional but recommended
      case 'finalize': return true;
      default: return false;
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Year-End Process — FY {fiscalYear?.year_label}</DialogTitle>
          <DialogDescription>Complete all steps to finalize this fiscal year. Once finalized, no entries can be modified.</DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 py-4">
          {steps.map((step, i) => (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => i <= stepIndex && setCurrentStep(step.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i === stepIndex
                    ? 'bg-primary text-primary-foreground'
                    : i < stepIndex
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.icon} {step.label}
              </button>
              {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[200px]">
          {/* Step 1: Close Months */}
          {currentStep === 'months' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">All months must be closed before proceeding. Open months are shown below.</p>
              {allMonthsClosed ? (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <p className="text-sm text-primary">All months are closed. You may proceed.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{openMonths.length} month(s) still open</p>
                    <Button size="sm" variant="outline" onClick={() => closeAllMonthsMutation.mutate()} disabled={closeAllMonthsMutation.isPending}>
                      Close All
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {openMonths.map(month => (
                      <div key={month.id} className="flex items-center justify-between p-3 rounded border bg-warning/5 border-warning/20">
                        <span className="text-sm font-medium">{month.month_label}</span>
                        <Button size="sm" variant="outline" onClick={() => closeMonthMutation.mutate(month.id)} disabled={closeMonthMutation.isPending}>
                          <Lock className="mr-1 h-3 w-3" /> Close
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2: Review Transactions */}
          {currentStep === 'transactions' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Review any pending or incomplete transactions before year-end.</p>
              <div className="space-y-2">
                <div className={`flex items-center justify-between p-3 rounded border ${(pendingChecks?.pendingBills || 0) > 0 ? 'bg-warning/5 border-warning/20' : 'bg-primary/5 border-primary/20'}`}>
                  <div className="flex items-center gap-2">
                    {(pendingChecks?.pendingBills || 0) > 0
                      ? <AlertTriangle className="h-4 w-4 text-warning" />
                      : <CheckCircle2 className="h-4 w-4 text-primary" />
                    }
                    <span className="text-sm">Pending Maintenance Bills</span>
                  </div>
                  <Badge variant={(pendingChecks?.pendingBills || 0) > 0 ? 'secondary' : 'default'}>
                    {pendingChecks?.pendingBills || 0}
                  </Badge>
                </div>
              </div>
              {(pendingChecks?.pendingBills || 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  ⚠ Pending bills will be carried forward to the next fiscal year. You can still proceed.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Audit Document */}
          {currentStep === 'audit' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Attach the final audit report signed by the Government-registered Auditor. This step is recommended but not mandatory.
              </p>
              <div>
                <Label>Audit Document URL</Label>
                <Input
                  placeholder="Paste URL of uploaded signed audit document"
                  value={auditDocUrl}
                  onChange={(e) => setAuditDocUrl(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Upload the document via Documents section first, then paste its URL here.</p>
              </div>
              {!auditDocUrl && (
                <div className="flex items-start gap-2 p-3 rounded bg-warning/5 border border-warning/20">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                  <p className="text-sm text-warning">No audit document attached. Proceeding without it is allowed but not recommended.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Finalize */}
          {currentStep === 'finalize' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-destructive/5 border-destructive/20">
                <h4 className="font-semibold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Final Warning
                </h4>
                <p className="text-sm text-destructive/80 mt-1">
                  Once finalized, <strong>no entries in FY {fiscalYear?.year_label} can be created, edited, or deleted</strong>. 
                  This action cannot be undone. Only the Super Admin has override capability for corrections.
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>All 12 months closed</span>
                </div>
                <div className="flex items-center gap-2">
                  {(pendingChecks?.pendingBills || 0) === 0
                    ? <CheckCircle2 className="h-4 w-4 text-primary" />
                    : <AlertTriangle className="h-4 w-4 text-warning" />
                  }
                  <span>{pendingChecks?.pendingBills || 0} pending bills (will carry forward)</span>
                </div>
                <div className="flex items-center gap-2">
                  {auditDocUrl
                    ? <CheckCircle2 className="h-4 w-4 text-primary" />
                    : <AlertTriangle className="h-4 w-4 text-warning" />
                  }
                  <span>Audit document {auditDocUrl ? 'attached' : 'not attached'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {stepIndex > 0 && (
            <Button variant="outline" onClick={() => setCurrentStep(steps[stepIndex - 1].key)}>Back</Button>
          )}
          {currentStep === 'finalize' ? (
            <Button
              variant="destructive"
              onClick={() => finalizeYearMutation.mutate()}
              disabled={!allMonthsClosed || finalizeYearMutation.isPending}
            >
              {finalizeYearMutation.isPending ? 'Finalizing...' : 'Finalize Year'}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep(steps[stepIndex + 1].key)}
              disabled={!canProceed()}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
