import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadPrivateFile } from '@/lib/fileStorage';
import { useAuthStore } from '@/stores/authStore';
import { format, differenceInYears } from 'date-fns';
import { User, Calendar, Home, FileText, Upload, Users, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export default function TenantPortal() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFamilyFormOpen, setIsFamilyFormOpen] = useState(false);
  const [familyForm, setFamilyForm] = useState({ name: '', relation: '', date_of_birth: '' });

  // Fetch tenant record linked to current user
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['my-tenant-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('*, flats(flat_number, wing, status)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch family members (via a tenant_family_members or general approach)
  const { data: familyMembers } = useQuery({
    queryKey: ['tenant-family', tenant?.id],
    queryFn: async () => {
      // For now, we'll use a simple approach - tenants don't have family_members FK
      // We could query by a separate table or use tenant metadata
      return [];
    },
    enabled: !!tenant?.id,
  });

  const uploadDoc = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      if (!tenant) throw new Error('No tenant record');
      const saved = await uploadPrivateFile({
        file,
        societyId: tenant.society_id,
        category: type === 'rent-agreement' ? 'Rent Agreement' : 'Police Verification',
        entityId: tenant.id,
      });

      const updateField = type === 'rent-agreement' ? 'rent_agreement_url' : 'police_verification_url';
      const { error } = await supabase.from('tenants').update({
        [updateField]: `php://${saved.id}`,
      }).eq('id', tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tenant-profile'] });
      toast({ title: 'Document uploaded successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-semibold">No Tenant Profile Found</h2>
          <p className="text-muted-foreground mt-2">Your account is not linked to any tenant record.</p>
        </div>
      </div>
    );
  }

  const flatLabel = tenant.flats ? `${tenant.flats.wing ? tenant.flats.wing + '-' : ''}${tenant.flats.flat_number}` : '-';
  const isVerified = !!tenant.verified_at;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Tenant Profile</h1>
          <p className="text-muted-foreground">View and manage your tenant information</p>
        </div>
        {isVerified ? (
          <Badge className="bg-success text-success-foreground gap-1 text-sm py-1 px-3">
            <ShieldCheck className="h-4 w-4" /> Verified
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1 text-sm py-1 px-3">
            <ShieldAlert className="h-4 w-4" /> Not Verified
          </Badge>
        )}
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="period">Tenant Period</TabsTrigger>
          <TabsTrigger value="rent">Rent Details</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Personal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Full Name', value: tenant.full_name },
                  { label: 'Flat', value: flatLabel },
                  { label: 'Mobile', value: tenant.mobile || '-' },
                  { label: 'Email', value: tenant.email || '-' },
                  { label: 'Aadhar', value: tenant.aadhar_masked ? `XXXX-XXXX-${tenant.aadhar_masked}` : '-' },
                  { label: 'Native Address', value: tenant.native_address || '-' },
                ].map(item => (
                  <div key={item.label} className="space-y-1">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="period">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Tenant Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="text-lg font-semibold">{tenant.validity_from ? format(new Date(tenant.validity_from), 'dd MMM yyyy') : '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">To</p>
                  <p className="text-lg font-semibold">{tenant.validity_to ? format(new Date(tenant.validity_to), 'dd MMM yyyy') : '-'}</p>
                </div>
              </div>
              {tenant.validity_to && new Date(tenant.validity_to) < new Date() && (
                <Badge variant="destructive">Period Expired</Badge>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rent">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> Rent Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="text-2xl font-bold">₹{tenant.rent_amount || 0}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Flat Status</span>
                  <Badge variant="outline">{tenant.flats?.status || '-'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> My Documents</CardTitle>
              <CardDescription>Upload your KYC documents and agreements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Rent Agreement</h4>
                  {tenant.rent_agreement_url ? (
                    <a href={tenant.rent_agreement_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                      <FileText className="h-4 w-4" /> View Document
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not uploaded</p>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer text-sm border border-dashed rounded px-3 py-2 hover:bg-accent">
                    <Upload className="h-4 w-4" /> Upload / Replace
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => e.target.files?.[0] && uploadDoc.mutate({ file: e.target.files[0], type: 'rent-agreement' })}
                    />
                  </label>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Police Verification</h4>
                  {tenant.police_verification_url ? (
                    <a href={tenant.police_verification_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                      <FileText className="h-4 w-4" /> View Document
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not uploaded</p>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer text-sm border border-dashed rounded px-3 py-2 hover:bg-accent">
                    <Upload className="h-4 w-4" /> Upload / Replace
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => e.target.files?.[0] && uploadDoc.mutate({ file: e.target.files[0], type: 'police-verification' })}
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
