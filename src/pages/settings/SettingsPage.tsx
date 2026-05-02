import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { Settings, Building, CreditCard, Bell, Shield, IndianRupee, Calendar, KeyRound } from 'lucide-react';
import { FiscalYearSettings } from '@/components/fiscal/FiscalYearSettings';
import { TemporaryAccessGrants } from '@/components/access/TemporaryAccessGrants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { currentSocietyId } = useAuthStore();
  const { currentSociety } = useSocietyStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: features } = useQuery({
    queryKey: ['feature_settings', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return null;
      const { data } = await supabase
        .from('feature_settings')
        .select('*')
        .eq('society_id', currentSocietyId)
        .single();
      return data;
    },
    enabled: !!currentSocietyId,
  });

  const { data: society } = useQuery({
    queryKey: ['society_details', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return null;
      const { data } = await supabase.from('societies').select('*').eq('id', currentSocietyId).single();
      return data;
    },
    enabled: !!currentSocietyId,
  });

  const { data: incomeHeads } = useQuery({
    queryKey: ['income_heads', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase.from('income_heads').select('*').eq('society_id', currentSocietyId).order('head_name');
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: expenseHeads } = useQuery({
    queryKey: ['expense_heads', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data } = await supabase.from('expense_heads').select('*').eq('society_id', currentSocietyId).order('head_name');
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const updateSocietyMutation = useMutation({
    mutationFn: async (values: Record<string, any>) => {
      if (!currentSocietyId) throw new Error('No society');
      const { error } = await supabase.from('societies').update(values).eq('id', currentSocietyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['society_details'] });
      toast({ title: 'Society details updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ feature, enabled }: { feature: string; enabled: boolean }) => {
      if (!currentSocietyId) throw new Error('No society');
      const { error } = await supabase
        .from('feature_settings')
        .update({ [feature]: enabled })
        .eq('society_id', currentSocietyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature_settings'] });
      toast({ title: 'Feature updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleHeadMutation = useMutation({
    mutationFn: async ({ table, id, is_active }: { table: 'income_heads' | 'expense_heads'; id: string; is_active: boolean }) => {
      const { error } = await supabase.from(table).update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_heads'] });
      queryClient.invalidateQueries({ queryKey: ['expense_heads'] });
      toast({ title: 'Category updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const [newHeadName, setNewHeadName] = useState('');
  const [newHeadType, setNewHeadType] = useState<'income' | 'expense'>('income');

  const addHeadMutation = useMutation({
    mutationFn: async ({ table, head_name }: { table: 'income_heads' | 'expense_heads'; head_name: string }) => {
      if (!currentSocietyId) throw new Error('No society');
      const { error } = await supabase.from(table).insert({ society_id: currentSocietyId, head_name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income_heads'] });
      queryClient.invalidateQueries({ queryKey: ['expense_heads'] });
      setNewHeadName('');
      toast({ title: 'Category added' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const featureToggles = [
    { key: 'enable_tenant_management', label: 'Tenant Management', desc: 'Track tenants, agreements, and police verification' },
    { key: 'enable_committee_management', label: 'Committee Management', desc: 'Manage committee members and roles' },
    { key: 'enable_document_management', label: 'Document Management', desc: 'Store and manage society documents' },
    { key: 'enable_amenity_booking', label: 'Amenity Booking', desc: 'Book common amenities like halls and courts' },
    { key: 'enable_visitor_management', label: 'Visitor Management', desc: 'Track visitor entries and approvals' },
    { key: 'enable_vendor_management', label: 'Vendor Management', desc: 'Manage vendor contracts and payments' },
    { key: 'enable_asset_management', label: 'Asset Management', desc: 'Track society assets and maintenance' },
    { key: 'enable_meeting_management', label: 'Meeting Management', desc: 'Schedule and manage committee meetings' },
    { key: 'enable_bank_reconciliation', label: 'Bank Reconciliation', desc: 'Reconcile bank statements with records' },
    { key: 'enable_online_payment', label: 'Online Payment', desc: 'Accept online payments from members' },
    { key: 'enable_email', label: 'Email Notifications', desc: 'Send email notifications to members' },
    { key: 'enable_sms', label: 'SMS Notifications', desc: 'Send SMS alerts to members' },
    { key: 'enable_whatsapp', label: 'WhatsApp Notifications', desc: 'Send WhatsApp messages to members' },
  ];

  const [editSociety, setEditSociety] = useState(false);
  const [societyForm, setSocietyForm] = useState<Record<string, string>>({});

  const initEdit = () => {
    if (society) {
      setSocietyForm({
        name: society.name || '',
        address: society.address || '',
        city: society.city || '',
        state: society.state || '',
        pincode: society.pincode || '',
        pan_number: society.pan_number || '',
        bank_name: society.bank_name || '',
        bank_account: society.bank_account || '',
        bank_ifsc: society.bank_ifsc || '',
      });
      setEditSociety(true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6" /> Settings
        </h1>
        <p className="text-muted-foreground">Manage society settings and feature toggles</p>
      </div>

      <Tabs defaultValue="society" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="society">Society Info</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal Year</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Society Info */}
        <TabsContent value="society">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" /> Society Details</CardTitle>
                  <CardDescription>View and edit society information</CardDescription>
                </div>
                {!editSociety && (
                  <Button variant="outline" onClick={initEdit}>Edit</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editSociety ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Society Name</Label>
                      <Input value={societyForm.name} onChange={(e) => setSocietyForm(p => ({ ...p, name: e.target.value }))} className="h-12 mt-1" />
                    </div>
                    <div>
                      <Label>PAN Number</Label>
                      <Input value={societyForm.pan_number} onChange={(e) => setSocietyForm(p => ({ ...p, pan_number: e.target.value }))} className="h-12 mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Textarea value={societyForm.address} onChange={(e) => setSocietyForm(p => ({ ...p, address: e.target.value }))} rows={2} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>City</Label>
                      <Input value={societyForm.city} onChange={(e) => setSocietyForm(p => ({ ...p, city: e.target.value }))} className="h-12 mt-1" />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input value={societyForm.state} onChange={(e) => setSocietyForm(p => ({ ...p, state: e.target.value }))} className="h-12 mt-1" />
                    </div>
                    <div>
                      <Label>Pincode</Label>
                      <Input value={societyForm.pincode} onChange={(e) => setSocietyForm(p => ({ ...p, pincode: e.target.value }))} className="h-12 mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Bank Name</Label>
                      <Input value={societyForm.bank_name} onChange={(e) => setSocietyForm(p => ({ ...p, bank_name: e.target.value }))} className="h-12 mt-1" />
                    </div>
                    <div>
                      <Label>Account Number</Label>
                      <Input value={societyForm.bank_account} onChange={(e) => setSocietyForm(p => ({ ...p, bank_account: e.target.value }))} className="h-12 mt-1" />
                    </div>
                    <div>
                      <Label>IFSC Code</Label>
                      <Input value={societyForm.bank_ifsc} onChange={(e) => setSocietyForm(p => ({ ...p, bank_ifsc: e.target.value }))} className="h-12 mt-1" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setEditSociety(false)} className="h-12">Cancel</Button>
                    <Button onClick={() => { updateSocietyMutation.mutate(societyForm); setEditSociety(false); }} className="h-12">Save Changes</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ['Name', society?.name],
                    ['Reg. No', society?.registration_no],
                    ['Address', society?.address],
                    ['City', society?.city],
                    ['State', society?.state],
                    ['Pincode', society?.pincode],
                    ['PAN', society?.pan_number],
                    ['Bank', society?.bank_name],
                    ['Account', society?.bank_account],
                    ['IFSC', society?.bank_ifsc],
                    ['Financial Year', society?.financial_year],
                    ['Package', society?.package_type],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{(value as string) || '-'}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Feature Toggles</CardTitle>
              <CardDescription>Enable or disable modules for this society</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureToggles.filter(f => !f.key.startsWith('enable_email') && !f.key.startsWith('enable_sms') && !f.key.startsWith('enable_whatsapp')).map(toggle => (
                  <div key={toggle.key} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <p className="font-medium">{toggle.label}</p>
                      <p className="text-sm text-muted-foreground">{toggle.desc}</p>
                    </div>
                    <Switch
                      checked={(features as any)?.[toggle.key] || false}
                      onCheckedChange={(checked) => toggleFeatureMutation.mutate({ feature: toggle.key, enabled: checked })}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notification Settings</CardTitle>
              <CardDescription>Configure communication channels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureToggles.filter(f => f.key.startsWith('enable_email') || f.key.startsWith('enable_sms') || f.key.startsWith('enable_whatsapp')).map(toggle => (
                  <div key={toggle.key} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <p className="font-medium">{toggle.label}</p>
                      <p className="text-sm text-muted-foreground">{toggle.desc}</p>
                    </div>
                    <Switch
                      checked={(features as any)?.[toggle.key] || false}
                      onCheckedChange={(checked) => toggleFeatureMutation.mutate({ feature: toggle.key, enabled: checked })}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Finance Settings */}
        <TabsContent value="finance">
          <div className="space-y-6">
            {/* Income Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><IndianRupee className="h-5 w-5" /> Income Categories</CardTitle>
                <CardDescription>Configure which category tabs appear in the Income Register</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incomeHeads?.map(head => (
                    <div key={head.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <p className="font-medium">{head.head_name}</p>
                        <p className="text-sm text-muted-foreground">{head.description || 'Income category'}</p>
                      </div>
                      <Switch
                        checked={head.is_active ?? true}
                        onCheckedChange={(checked) => toggleHeadMutation.mutate({ table: 'income_heads', id: head.id, is_active: checked })}
                      />
                    </div>
                  ))}
                  {(!incomeHeads || incomeHeads.length === 0) && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No income categories configured yet</p>
                  )}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Input
                    placeholder="New income category name"
                    value={newHeadType === 'income' ? newHeadName : ''}
                    onChange={(e) => { setNewHeadType('income'); setNewHeadName(e.target.value); }}
                    className="h-10"
                  />
                  <Button
                    size="sm"
                    className="h-10"
                    disabled={!newHeadName.trim() || newHeadType !== 'income'}
                    onClick={() => addHeadMutation.mutate({ table: 'income_heads', head_name: newHeadName.trim() })}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Expense Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Expense Categories</CardTitle>
                <CardDescription>Configure which category tabs appear in the Expense Register</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expenseHeads?.map(head => (
                    <div key={head.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <p className="font-medium">{head.head_name}</p>
                        <p className="text-sm text-muted-foreground">{head.description || 'Expense category'}</p>
                      </div>
                      <Switch
                        checked={head.is_active ?? true}
                        onCheckedChange={(checked) => toggleHeadMutation.mutate({ table: 'expense_heads', id: head.id, is_active: checked })}
                      />
                    </div>
                  ))}
                  {(!expenseHeads || expenseHeads.length === 0) && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No expense categories configured yet</p>
                  )}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Input
                    placeholder="New expense category name"
                    value={newHeadType === 'expense' ? newHeadName : ''}
                    onChange={(e) => { setNewHeadType('expense'); setNewHeadName(e.target.value); }}
                    className="h-10"
                  />
                  <Button
                    size="sm"
                    className="h-10"
                    disabled={!newHeadName.trim() || newHeadType !== 'expense'}
                    onClick={() => addHeadMutation.mutate({ table: 'expense_heads', head_name: newHeadName.trim() })}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* Fiscal Year Settings */}
        <TabsContent value="fiscal">
          <FiscalYearSettings />
        </TabsContent>
        <TabsContent value="access">
          <TemporaryAccessGrants />
        </TabsContent>
      </Tabs>
    </div>
  );
}
