import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, ShieldAlert, FileText } from 'lucide-react';

interface Props {
  tenant: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantDetailDialog({ tenant, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuthStore();
  const isAdmin = hasRole('society_admin') || hasRole('super_admin');

  // Owner confirms tenant (step 1 → step 2)
  const ownerVerifyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tenants').update({
        verification_status: 'society_pending',
      }).eq('id', tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({ title: 'Owner verification complete', description: 'Pending society admin verification.' });
    },
  });

  // Society admin verifies (step 2 → active)
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tenants').update({
        verified_at: new Date().toISOString(),
        verified_by: user?.id,
        verification_status: 'active',
      }).eq('id', tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast({ title: 'Tenant verified and activated' });
    },
  });

  if (!tenant) return null;

  const verificationStatus = tenant.verification_status || (tenant.verified_at ? 'active' : 'owner_pending');

  const rows = [
    { label: 'Flat', value: tenant.flats ? `${tenant.flats.wing ? tenant.flats.wing + '-' : ''}${tenant.flats.flat_number}` : '-' },
    { label: 'Mobile', value: tenant.mobile || '-' },
    { label: 'Email', value: tenant.email || '-' },
    { label: 'Monthly Rent', value: tenant.rent_amount ? `₹${tenant.rent_amount}` : '-' },
    { label: 'Aadhar', value: tenant.aadhar_masked ? `XXXX-XXXX-${tenant.aadhar_masked}` : '-' },
    { label: 'Native Address', value: tenant.native_address || '-' },
    { label: 'Verification Step', value: verificationStatus === 'owner_pending' ? 'Owner Pending' : verificationStatus === 'society_pending' ? 'Society Pending' : verificationStatus === 'active' ? 'Verified & Active' : verificationStatus === 'rejected' ? 'Rejected' : '-' },
    { label: 'Tenant Period', value: tenant.validity_from && tenant.validity_to ? `${format(new Date(tenant.validity_from), 'dd MMM yyyy')} - ${format(new Date(tenant.validity_to), 'dd MMM yyyy')}` : '-' },
  ];

  const isVerified = !!tenant.verified_at;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {tenant.full_name}
            <Badge variant={tenant.is_active ? 'default' : 'secondary'}>
              {tenant.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {isVerified ? (
              <Badge variant="default" className="bg-green-600 text-white gap-1">
                <ShieldCheck className="h-3 w-3" /> Verified
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="h-3 w-3" /> Not Verified
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium text-foreground">{r.value}</span>
            </div>
          ))}

          {/* Document links */}
          <div className="pt-2 border-t space-y-2">
            <p className="text-sm font-medium">Documents</p>
            {tenant.rent_agreement_url ? (
              <a href={tenant.rent_agreement_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <FileText className="h-4 w-4" /> Rent Agreement
              </a>
            ) : <p className="text-xs text-muted-foreground">No rent agreement uploaded</p>}
            {tenant.police_verification_url ? (
              <a href={tenant.police_verification_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                <FileText className="h-4 w-4" /> Police Verification
              </a>
            ) : <p className="text-xs text-muted-foreground">No police verification uploaded</p>}
          </div>

          {/* Verification workflow buttons */}
          {verificationStatus === 'owner_pending' && (
            <div className="pt-2 border-t">
              <Button
                onClick={() => ownerVerifyMutation.mutate()}
                disabled={ownerVerifyMutation.isPending}
                className="w-full"
                variant="outline"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {ownerVerifyMutation.isPending ? 'Confirming...' : 'Owner: Confirm Tenant Details'}
              </Button>
            </div>
          )}
          {isAdmin && verificationStatus === 'society_pending' && (
            <div className="pt-2 border-t">
              <Button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                className="w-full"
                variant="default"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {verifyMutation.isPending ? 'Verifying...' : 'Society: Verify & Activate Tenant'}
              </Button>
            </div>
          )}
          {isAdmin && !isVerified && verificationStatus !== 'society_pending' && verificationStatus !== 'owner_pending' && (
            <div className="pt-2 border-t">
              <Button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                className="w-full"
                variant="default"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {verifyMutation.isPending ? 'Verifying...' : 'Verify Tenant Agreement'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
