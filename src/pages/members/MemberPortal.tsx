import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format, differenceInYears } from 'date-fns';
import {
  User, Users, Plus, Trash2, Home, Key, Upload, IndianRupee,
  CheckCircle2, XCircle, Clock, AlertTriangle, Receipt, ChevronsRight,
  Camera, Building2, LayoutDashboard, Bell, FileText, Edit,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PAYMENT_MODES = [
  { value: 'upi', label: 'UPI / Google Pay / PhonePe' },
  { value: 'neft', label: 'NEFT / RTGS / Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card / POS' },
];
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const FLAT_STATUSES = [
  { value: 'owner_occupied', label: 'Self Occupied' },
  { value: 'rented', label: 'Rented Out' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'available_for_tenant', label: 'Available for Tenant' },
  { value: 'available_for_sale', label: 'Available for Sale' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-l-amber-400',
  approved: 'border-l-green-500',
  rejected: 'border-l-red-500',
};

export default function MemberPortal() {
  const { user, currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState('dashboard');
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);
  const [editFamilyMember, setEditFamilyMember] = useState<any>(null);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isTenantOpen, setIsTenantOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<any>(null);
  const [editFlatStatus, setEditFlatStatus] = useState<any>(null);

  const emptyFamily = { name: '', relation: '', date_of_birth: '', blood_group: '', education: '', occupation: '', employer: '', contact_number: '', email: '', photo_url: '', is_dependent: true };
  const [familyForm, setFamilyForm] = useState(emptyFamily);
  const [pwForm, setPwForm] = useState({ newPw: '', confirmPw: '' });
  const [selectedFlatIds, setSelectedFlatIds] = useState<string[]>([]);
  const [payForm, setPayForm] = useState({
    submission_type: 'maintenance',
    income_head_id: '',
    expense_head_id: '',
    amount: '',
    payment_mode: '',
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    period_month: String(new Date().getMonth() + 1),
    period_year: String(new Date().getFullYear()),
    transaction_ref: '',
    bank_name: '',
    notes: '',
    is_expense_claim: false,
    adjustment_in_maintenance: false,
    reimbursement_mode: '',
    attachment_file: null as File | null,
  });
  const emptyTenant = { flat_id: '', full_name: '', mobile: '', email: '', aadhar_masked: '', native_address: '', rent_amount: '', deposit_amount: '', validity_from: '', validity_to: '' };
  const [tenantForm, setTenantForm] = useState(emptyTenant);
  const [familyPhotoFile, setFamilyPhotoFile] = useState<File | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: members, isLoading } = useQuery({
    queryKey: ['my-member-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('members')
        .select('*, flats(id, flat_number, wing, floor, area_sqft, parking_slots, status)')
        .eq('user_id', user.id).eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const primaryMember = members?.[0];

  const { data: familyMembers } = useQuery({
    queryKey: ['family-members', primaryMember?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('family_members').select('*').eq('member_id', primaryMember!.id).order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!primaryMember?.id,
  });

  const { data: myTenants } = useQuery({
    queryKey: ['my-tenants', primaryMember?.id],
    queryFn: async () => {
      const flatIds = members!.map(m => m.flat_id).filter(Boolean);
      if (!flatIds.length) return [];
      const { data, error } = await supabase.from('tenants')
        .select('*, flats(flat_number, wing)').in('flat_id', flatIds).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!members?.length,
  });

  const { data: mySubmissions } = useQuery({
    queryKey: ['my-payment-submissions', primaryMember?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_payment_submissions')
        .select(`
          *,
          income_heads!member_payment_submissions_income_head_id_fkey(head_name),
          expense_heads!member_payment_submissions_expense_head_id_fkey(head_name)
        `)
        .eq('member_id', primaryMember!.id)
        .order('created_at', { ascending: false });
      if (error) { console.error('submissions error:', error); return []; }
      return data || [];
    },
    enabled: !!primaryMember?.id,
  });

  const { data: myBills } = useQuery({
    queryKey: ['my-bills', primaryMember?.id],
    queryFn: async () => {
      const flatIds = members!.map(m => m.flat_id).filter(Boolean);
      if (!flatIds.length) return [];
      const { data, error } = await supabase.from('maintenance_bills')
        .select('*, flats(flat_number, wing)').in('flat_id', flatIds)
        .order('bill_year', { ascending: false }).order('bill_month', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!members?.length,
  });

  const { data: incomeHeads } = useQuery({
    queryKey: ['income-heads', currentSocietyId],
    queryFn: async () => {
      const { data } = await supabase.from('income_heads').select('id, head_name').eq('society_id', currentSocietyId!).eq('is_active', true);
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const { data: expenseHeads } = useQuery({
    queryKey: ['expense-heads', currentSocietyId],
    queryFn: async () => {
      const { data } = await supabase.from('expense_heads').select('id, head_name').eq('society_id', currentSocietyId!).eq('is_active', true);
      return data || [];
    },
    enabled: !!currentSocietyId && payForm.is_expense_claim,
  });

  const { data: myComplaints } = useQuery({
    queryKey: ['my-complaints', primaryMember?.id],
    queryFn: async () => {
      const { data } = await supabase.from('complaints').select('*').eq('society_id', currentSocietyId!).eq('created_by', user!.id).order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!primaryMember?.id && !!currentSocietyId,
  });

  // ── Upload photo ────────────────────────────────────────────────────────────
  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop();
      const path = `member-photos/${primaryMember!.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path);
      const { error: updateErr } = await supabase.from('members').update({ photo_url: publicUrl }).eq('id', primaryMember!.id);
      if (updateErr) throw updateErr;
      // Also update profile
      await supabase.from('profiles').update({ profile_photo_url: publicUrl }).eq('id', user!.id);
      return publicUrl;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-member-profile'] }); toast({ title: 'Photo updated' }); },
    onError: (e: any) => toast({ title: 'Upload failed', description: e.message, variant: 'destructive' }),
  });

  // ── Family member mutations ──────────────────────────────────────────────────
  const saveFamilyMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = editFamilyMember?.photo_url || '';
      if (familyPhotoFile) {
        const ext = familyPhotoFile.name.split('.').pop();
        const path = `family-photos/${primaryMember!.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('profile-photos').upload(path, familyPhotoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path);
        photoUrl = publicUrl;
      }
      const payload = { ...familyForm, member_id: primaryMember!.id, photo_url: photoUrl || null, date_of_birth: familyForm.date_of_birth || null };
      if (editFamilyMember) {
        const { error } = await supabase.from('family_members').update(payload).eq('id', editFamilyMember.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('family_members').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-members'] });
      toast({ title: editFamilyMember ? 'Updated' : 'Added' });
      setIsFamilyOpen(false); setEditFamilyMember(null); setFamilyForm(emptyFamily); setFamilyPhotoFile(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteFamily = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('family_members').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['family-members'] }); },
  });

  const changePw = useMutation({
    mutationFn: async () => {
      if (pwForm.newPw !== pwForm.confirmPw) throw new Error('Passwords do not match');
      if (pwForm.newPw.length < 6) throw new Error('Minimum 6 characters');
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Password changed' }); setIsPasswordOpen(false); setPwForm({ newPw: '', confirmPw: '' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!payForm.attachment_file) throw new Error('Payment proof attachment is required');
      if (!payForm.amount || Number(payForm.amount) <= 0) throw new Error('Enter a valid amount');
      if (!payForm.payment_mode) throw new Error('Select payment mode');
      if (!primaryMember) throw new Error('No member profile');

      // Use selected flats or primary flat
      const targetFlatId = selectedFlatIds.length === 1 ? selectedFlatIds[0] : primaryMember.flat_id;
      if (!targetFlatId) throw new Error('No flat assigned');

      const file = payForm.attachment_file;
      const ext = file.name.split('.').pop();
      const filename = `payment-proofs/${primaryMember.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(filename, file, { upsert: true });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filename);

      // If multiple flats selected, create one submission per flat
      const flatIds = selectedFlatIds.length > 0 ? selectedFlatIds : [targetFlatId];
      const amountPerFlat = Number(payForm.amount) / flatIds.length;

      for (const fId of flatIds) {
        const memberForFlat = members!.find(m => m.flat_id === fId) || primaryMember;
        await supabase.from('member_payment_submissions').insert({
          society_id: currentSocietyId,
          member_id: memberForFlat.id,
          flat_id: fId,
          submission_type: payForm.is_expense_claim ? 'society_expense' : payForm.submission_type,
          income_head_id: !payForm.is_expense_claim && payForm.income_head_id ? payForm.income_head_id : null,
          expense_head_id: payForm.is_expense_claim && payForm.expense_head_id ? payForm.expense_head_id : null,
          amount: flatIds.length > 1 ? amountPerFlat : Number(payForm.amount),
          payment_mode: payForm.payment_mode,
          payment_date: payForm.payment_date,
          period_month: payForm.period_month ? Number(payForm.period_month) : null,
          period_year: payForm.period_year ? Number(payForm.period_year) : null,
          transaction_ref: payForm.transaction_ref || null,
          bank_name: payForm.bank_name || null,
          notes: payForm.notes || null,
          is_expense_claim: payForm.is_expense_claim,
          adjustment_in_maintenance: payForm.adjustment_in_maintenance,
          reimbursement_mode: payForm.reimbursement_mode || null,
          attachment_url: publicUrl,
          attachment_filename: file.name,
          created_by: user!.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-payment-submissions'] });
      toast({ title: 'Payment submitted', description: 'Treasurer will review and approve soon.' });
      setIsPaymentOpen(false);
      setPayForm(f => ({ ...f, amount: '', transaction_ref: '', notes: '', attachment_file: null }));
      setSelectedFlatIds([]);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveTenant = useMutation({
    mutationFn: async () => {
      if (!tenantForm.flat_id) throw new Error('Select a flat');
      if (!tenantForm.full_name) throw new Error('Enter tenant name');
      const payload = {
        society_id: currentSocietyId, flat_id: tenantForm.flat_id,
        full_name: tenantForm.full_name, mobile: tenantForm.mobile || null,
        email: tenantForm.email || null, aadhar_masked: tenantForm.aadhar_masked || null,
        native_address: tenantForm.native_address || null,
        rent_amount: tenantForm.rent_amount ? Number(tenantForm.rent_amount) : null,
        deposit_amount: tenantForm.deposit_amount ? Number(tenantForm.deposit_amount) : null,
        validity_from: tenantForm.validity_from || null,
        validity_to: tenantForm.validity_to || null,
        is_active: false, approval_status: 'pending', approved_by_member: false,
      };
      if (editTenant) {
        const { error } = await supabase.from('tenants').update(payload).eq('id', editTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tenants').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tenants'] });
      toast({ title: editTenant ? 'Tenant updated' : 'Tenant added for approval' });
      setIsTenantOpen(false); setEditTenant(null); setTenantForm(emptyTenant);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const approveTenant = useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await supabase.from('tenants').update({ approved_by_member: true, member_approved_at: new Date().toISOString() }).eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tenants'] }); toast({ title: 'Tenant approved — awaiting admin activation' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const markTenantLeft = useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await supabase.from('tenants').update({ is_active: false, validity_to: new Date().toISOString().split('T')[0] }).eq('id', tenantId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tenants'] }); toast({ title: 'Tenant marked as left' }); },
  });

  const updateFlatStatus = useMutation({
    mutationFn: async ({ flatId, status }: { flatId: string; status: string }) => {
      const { error } = await supabase.from('flats').update({ status }).eq('id', flatId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-member-profile'] }); toast({ title: 'Flat status updated' }); setEditFlatStatus(null); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (!primaryMember) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <User className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold">No Member Profile Found</h2>
        <p className="text-muted-foreground mt-2">Your account is not linked to any member record.<br />Contact your society admin.</p>
      </div>
    </div>
  );

  const allFlats = members?.map(m => m.flats as any).filter(Boolean) || [];
  const pendingBills = myBills?.filter(b => !b.is_paid) || [];
  const pendingSubmissions = mySubmissions?.filter(s => s.status === 'pending').length || 0;

  const calcAge = (dob: string) => {
    try { return differenceInYears(new Date(), new Date(dob)); } catch { return null; }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* Profile Photo */}
          <div className="relative">
            <Avatar className="h-16 w-16 cursor-pointer" onClick={() => photoInputRef.current?.click()}>
              <AvatarImage src={(primaryMember as any).photo_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {primaryMember.full_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => photoInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1 shadow"
            >
              <Camera className="h-3 w-3" />
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhotoMutation.mutate(f); }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{primaryMember.full_name}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              {allFlats.length === 0 && <span className="text-sm text-muted-foreground flex items-center gap-1"><Home className="h-3 w-3" />Flat not assigned</span>}
              {allFlats.map((f: any) => (
                <Badge key={f.id} variant="outline" className="text-xs">
                  <Home className="h-3 w-3 mr-1" />
                  {f.wing ? `${f.wing}-` : ''}{f.flat_number}
                  {f.floor != null ? ` · Floor ${f.floor}` : ''}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="gap-1">
            <LayoutDashboard className="h-4 w-4" /> Society Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsPasswordOpen(true)}>
            <Key className="h-4 w-4 mr-1" /> Password
          </Button>
          <Button size="sm" onClick={() => setIsPaymentOpen(true)}>
            <IndianRupee className="h-4 w-4 mr-1" /> Submit Payment
          </Button>
        </div>
      </div>

      {/* Pending bills alert */}
      {pendingBills.length > 0 && (
        <Card className="border-amber-400 bg-amber-50">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-800">
                  {pendingBills.length} pending due{pendingBills.length > 1 ? 's' : ''} — Total: ₹{pendingBills.reduce((s, b) => s + Number(b.bill_amount), 0).toLocaleString('en-IN')}
                </span>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => { setIsPaymentOpen(true); setTab('payments'); }}>
                Pay Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="family">Family ({familyMembers?.length || 0})</TabsTrigger>
          <TabsTrigger value="flats">My Flats ({allFlats.length})</TabsTrigger>
          <TabsTrigger value="tenants">Tenants ({myTenants?.length || 0})</TabsTrigger>
          <TabsTrigger value="payments" className="relative">
            Payments
            {pendingSubmissions > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{pendingSubmissions}</span>}
          </TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>

        {/* ── MEMBER DASHBOARD ─────────────────────────────────────────────────── */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Pending Dues', value: `₹${pendingBills.reduce((s,b)=>s+Number(b.bill_amount),0).toLocaleString('en-IN')}`, color: 'text-red-600' },
              { label: 'My Flats', value: allFlats.length, color: 'text-blue-600' },
              { label: 'Active Tenants', value: myTenants?.filter(t=>t.is_active).length || 0, color: 'text-green-600' },
              { label: 'Payments This Year', value: mySubmissions?.filter(s=>s.status==='approved' && new Date(s.created_at!).getFullYear() === new Date().getFullYear()).length || 0, color: 'text-purple-600' },
            ].map(stat => (
              <Card key={stat.label}><CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </CardContent></Card>
            ))}
          </div>
          {/* Pending bills list */}
          {pendingBills.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming / Pending Dues</CardTitle></CardHeader>
              <CardContent>
                <Table><TableHeader><TableRow><TableHead>Flat</TableHead><TableHead>Month/Year</TableHead><TableHead>Amount</TableHead><TableHead>Due Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>{pendingBills.slice(0,5).map(b => (
                    <TableRow key={b.id}>
                      <TableCell>{(b.flats as any)?.wing ? `${(b.flats as any).wing}-` : ''}{(b.flats as any)?.flat_number || '-'}</TableCell>
                      <TableCell>{MONTHS[(b.bill_month||1)-1]} {b.bill_year}</TableCell>
                      <TableCell className="font-semibold">₹{Number(b.bill_amount).toLocaleString('en-IN')}</TableCell>
                      <TableCell>{b.due_date ? format(new Date(b.due_date), 'dd MMM yyyy') : '-'}</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={()=>setIsPaymentOpen(true)}>Pay</Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {/* Recent transactions */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
            <CardContent>
              {mySubmissions?.slice(0,5).length ? (
                <div className="space-y-2">
                  {mySubmissions.slice(0,5).map(s => (
                    <div key={s.id} className={`flex items-center justify-between p-2 rounded border-l-4 ${STATUS_COLORS[s.status]}`}>
                      <div>
                        <p className="text-sm font-medium">₹{Number(s.amount).toLocaleString('en-IN')} · {(s as any).income_heads?.head_name || s.submission_type}</p>
                        <p className="text-xs text-muted-foreground">{s.payment_date ? format(new Date(s.payment_date), 'dd MMM yyyy') : '-'}</p>
                      </div>
                      <Badge variant={s.status === 'approved' ? 'default' : s.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs capitalize">{s.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PROFILE ───────────────────────────────────────────────────────────── */}
        <TabsContent value="profile">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Personal Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: 'Full Name', value: primaryMember.full_name },
                  { label: 'Mobile', value: primaryMember.mobile || '-' },
                  { label: 'Email', value: primaryMember.email || '-' },
                  { label: 'Aadhar (masked)', value: primaryMember.aadhar_masked ? `XXXX-XXXX-${primaryMember.aadhar_masked}` : '-' },
                  { label: 'PAN (masked)', value: primaryMember.pan_masked ? `XXXXX${primaryMember.pan_masked}` : '-' },
                  { label: 'Member Since', value: primaryMember.ownership_date ? format(new Date(primaryMember.ownership_date), 'dd MMM yyyy') : '-' },
                ].map(({ label, value }) => (
                  <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium mt-0.5">{value}</p></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FAMILY ───────────────────────────────────────────────────────────── */}
        <TabsContent value="family">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Family Members</CardTitle><CardDescription>{familyMembers?.length || 0} members</CardDescription></div>
              <Button size="sm" onClick={() => { setEditFamilyMember(null); setFamilyForm(emptyFamily); setFamilyPhotoFile(null); setIsFamilyOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add</Button>
            </CardHeader>
            <CardContent>
              {familyMembers?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {familyMembers.map(fm => {
                    const age = fm.date_of_birth ? calcAge(fm.date_of_birth) : null;
                    return (
                      <Card key={fm.id} className="border">
                        <CardContent className="pt-4">
                          <div className="flex gap-3">
                            <Avatar className="h-12 w-12 flex-shrink-0">
                              <AvatarImage src={(fm as any).photo_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary">{fm.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold">{fm.name}</p>
                                  <p className="text-xs text-muted-foreground">{fm.relation}{age !== null ? ` · Age ${age}` : ''}{(fm as any).blood_group ? ` · ${(fm as any).blood_group}` : ''}</p>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditFamilyMember(fm); setFamilyForm({ name: fm.name, relation: fm.relation||'', date_of_birth: fm.date_of_birth||'', blood_group: (fm as any).blood_group||'', education: (fm as any).education||'', occupation: (fm as any).occupation||'', employer: (fm as any).employer||'', contact_number: (fm as any).contact_number||'', email: (fm as any).email||'', photo_url: (fm as any).photo_url||'', is_dependent: (fm as any).is_dependent ?? true }); setIsFamilyOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteFamily.mutate(fm.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                {(fm as any).education && <span>🎓 {(fm as any).education}</span>}
                                {(fm as any).occupation && <span>💼 {(fm as any).occupation}</span>}
                                {(fm as any).contact_number && <span>📞 {(fm as any).contact_number}</span>}
                                {(fm as any).email && <span>✉️ {(fm as any).email}</span>}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10"><Users className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-2 text-muted-foreground">No family members added</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MY FLATS ─────────────────────────────────────────────────────────── */}
        <TabsContent value="flats">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members?.map(m => {
              const f = m.flats as any;
              if (!f) return null;
              const statusLabel = FLAT_STATUSES.find(s => s.value === f.status)?.label || f.status;
              return (
                <Card key={m.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold">{f.wing ? `Wing ${f.wing} - ` : ''}Flat {f.flat_number}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline" className="capitalize">{statusLabel}</Badge>
                          {f.floor != null && <Badge variant="outline">Floor {f.floor}</Badge>}
                          {f.area_sqft && <Badge variant="outline">{f.area_sqft} sq.ft</Badge>}
                          {f.parking_slots > 0 && <Badge variant="outline">🚗 {f.parking_slots} parking</Badge>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditFlatStatus({ flatId: f.id, currentStatus: f.status })}>
                        <Edit className="h-3.5 w-3.5 mr-1" />Status
                      </Button>
                    </div>
                    {/* Tenant info for this flat */}
                    {myTenants?.some(t => t.flat_id === f.id && t.is_active) && (
                      <div className="mt-3 p-2 bg-green-50 rounded text-sm">
                        <p className="text-green-700 font-medium">Occupied by tenant</p>
                        {myTenants.filter(t => t.flat_id === f.id && t.is_active).map(t => (
                          <p key={t.id} className="text-green-600 text-xs">{t.full_name} · {t.mobile || '-'}</p>
                        ))}
                      </div>
                    )}
                    {(f.status === 'available_for_tenant' || f.status === 'available_for_sale') && (
                      <p className="mt-2 text-xs text-amber-600">📢 Flat is listed as {statusLabel}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {allFlats.length === 0 && (
              <div className="col-span-2 text-center py-10 border-2 border-dashed rounded-lg">
                <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-2 text-muted-foreground">No flats assigned to your account</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TENANTS ──────────────────────────────────────────────────────────── */}
        <TabsContent value="tenants">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>My Tenants</CardTitle><CardDescription>Tenants across your flats. You must approve before admin activates.</CardDescription></div>
              <Button size="sm" onClick={() => { setEditTenant(null); setTenantForm(emptyTenant); setIsTenantOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add Tenant</Button>
            </CardHeader>
            <CardContent>
              {myTenants?.length ? (
                <div className="space-y-3">
                  {myTenants.map(t => {
                    const memberApproved = (t as any).approved_by_member;
                    const approvalStatus = (t as any).approval_status || 'pending';
                    return (
                      <Card key={t.id} className={`border-l-4 ${t.is_active ? 'border-l-green-500' : approvalStatus === 'rejected' ? 'border-l-red-500' : 'border-l-amber-400'}`}>
                        <CardContent className="pt-4">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-semibold">{t.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Flat: {(t.flats as any)?.wing ? `${(t.flats as any).wing}-` : ''}{(t.flats as any)?.flat_number}
                                {t.mobile && ` · ${t.mobile}`}
                              </p>
                              {t.validity_from && t.validity_to && <p className="text-xs text-muted-foreground">{format(new Date(t.validity_from),'dd MMM yy')} → {format(new Date(t.validity_to),'dd MMM yy')}</p>}
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                {(t as any).rent_amount && <span>Rent: ₹{(t as any).rent_amount}/mo</span>}
                                {(t as any).deposit_amount && <span>Deposit: ₹{(t as any).deposit_amount}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              <Badge variant={t.is_active ? 'default' : approvalStatus === 'rejected' ? 'destructive' : 'secondary'}>
                                {t.is_active ? 'Active' : approvalStatus === 'rejected' ? 'Rejected' : memberApproved ? 'Awaiting Admin' : 'Your Approval Needed'}
                              </Badge>
                              <div className="flex gap-2">
                                {!memberApproved && approvalStatus !== 'approved' && (
                                  <Button size="sm" onClick={() => approveTenant.mutate(t.id)}><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve</Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => { setEditTenant(t); setTenantForm({ flat_id: t.flat_id||'', full_name: t.full_name, mobile: t.mobile||'', email: t.email||'', aadhar_masked: t.aadhar_masked||'', native_address: t.native_address||'', rent_amount: String((t as any).rent_amount||''), deposit_amount: String((t as any).deposit_amount||''), validity_from: t.validity_from||'', validity_to: t.validity_to||'' }); setIsTenantOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                                {t.is_active && <Button size="sm" variant="destructive" onClick={() => markTenantLeft.mutate(t.id)}>Mark Left</Button>}
                              </div>
                            </div>
                          </div>
                          {(t as any).rejection_reason && <p className="mt-2 text-sm text-destructive bg-destructive/10 rounded p-2">Rejected: {(t as any).rejection_reason}</p>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10"><Home className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-2 text-muted-foreground">No tenants yet</p></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PAYMENTS ─────────────────────────────────────────────────────────── */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Payment Submissions</CardTitle><CardDescription>Submit payment proofs. Approved entries appear in society ledger.</CardDescription></div>
              <Button size="sm" onClick={() => setIsPaymentOpen(true)}><Plus className="h-4 w-4 mr-1" />Submit Payment</Button>
            </CardHeader>
            <CardContent>
              {mySubmissions?.length ? (
                <div className="space-y-3">
                  {mySubmissions.map(s => (
                    <Card key={s.id} className={`border-l-4 ${STATUS_COLORS[s.status]}`}>
                      <CardContent className="pt-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold">₹{Number(s.amount).toLocaleString('en-IN')}</span>
                              <Badge variant="outline" className="text-xs capitalize">{s.payment_mode?.replace('_','/')}</Badge>
                              {(s as any).is_expense_claim && <Badge variant="secondary" className="text-xs">Expense Claim</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {(s as any).income_heads?.head_name || (s as any).expense_heads?.head_name || s.submission_type}
                              {s.period_month && s.period_year && ` · ${MONTHS[s.period_month-1]} ${s.period_year}`}
                            </p>
                            <p className="text-xs text-muted-foreground">Paid: {s.payment_date ? format(new Date(s.payment_date),'dd MMM yyyy') : '-'}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={s.status === 'approved' ? 'default' : s.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{s.status}</Badge>
                            {s.attachment_url && <a href={s.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View Proof</a>}
                          </div>
                        </div>
                        {s.status === 'rejected' && s.rejection_reason && (
                          <div className="mt-2 bg-destructive/10 rounded p-2 flex gap-2"><AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" /><p className="text-sm text-destructive">{s.rejection_reason}</p></div>
                        )}
                        {s.status === 'approved' && (
                          <p className="mt-2 text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Approved & posted to society ledger</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10"><Receipt className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-2 text-muted-foreground">No submissions yet</p><Button size="sm" className="mt-3" onClick={()=>setIsPaymentOpen(true)}><Plus className="h-4 w-4 mr-1" />Submit Payment</Button></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COMPLAINTS ───────────────────────────────────────────────────────── */}
        <TabsContent value="complaints">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />My Complaints</CardTitle></CardHeader>
            </CardHeader>
            <CardContent>
              {myComplaints?.length ? (
                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Title</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>{myComplaints.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{format(new Date(c.created_at!),'dd MMM yy')}</TableCell>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize text-xs">{c.priority}</Badge></TableCell>
                      <TableCell><Badge variant={c.status === 'resolved' ? 'default' : c.status === 'open' ? 'destructive' : 'secondary'} className="capitalize text-xs">{c.status?.replace('_',' ')}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No complaints raised</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── SUBMIT PAYMENT DIALOG ─────────────────────────────────────────────── */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><IndianRupee className="h-5 w-5" />Submit Payment</DialogTitle>
            <DialogDescription><strong className="text-destructive">Attachment of payment proof is mandatory.</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Multi-flat selector */}
            {allFlats.length > 1 && (
              <div className="border rounded-lg p-3">
                <Label className="font-medium">Select Flat(s) for this payment</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {allFlats.map((f: any) => (
                    <label key={f.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedFlatIds.includes(f.id)}
                        onCheckedChange={v => {
                          if (v) setSelectedFlatIds(p => [...p, f.id]);
                          else setSelectedFlatIds(p => p.filter(id => id !== f.id));
                        }}
                      />
                      <span className="text-sm">{f.wing ? `${f.wing}-` : ''}{f.flat_number}</span>
                    </label>
                  ))}
                </div>
                {selectedFlatIds.length > 1 && (
                  <p className="text-xs text-amber-600 mt-2">Amount will be split equally across {selectedFlatIds.length} flats</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <Switch checked={payForm.is_expense_claim} onCheckedChange={v => setPayForm(f => ({ ...f, is_expense_claim: v }))} />
              <div>
                <Label className="font-medium">{payForm.is_expense_claim ? '💼 Society Expense Claim' : '🏠 Maintenance / Society Payment'}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{payForm.is_expense_claim ? 'I paid an expense on behalf of the society — need reimbursement' : 'Paying my maintenance dues or other society charges'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{payForm.is_expense_claim ? 'Expense Category' : 'Payment Type'}</Label>
                {payForm.is_expense_claim ? (
                  <Select value={payForm.expense_head_id} onValueChange={v => setPayForm(f => ({ ...f, expense_head_id: v }))}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{expenseHeads?.map(h => <SelectItem key={h.id} value={h.id}>{h.head_name}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Select value={payForm.income_head_id} onValueChange={v => setPayForm(f => ({ ...f, income_head_id: v }))}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select payment type" /></SelectTrigger>
                    <SelectContent>{incomeHeads?.map(h => <SelectItem key={h.id} value={h.id}>{h.head_name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div><Label>Amount (₹) *</Label><Input type="number" className="h-11 mt-1" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={payForm.payment_mode} onValueChange={v => setPayForm(f => ({ ...f, payment_mode: v }))}>
                  <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="How did you pay?" /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Payment Date *</Label><Input type="date" className="h-11 mt-1" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} /></div>
              {!payForm.is_expense_claim && <>
                <div>
                  <Label>For Month</Label>
                  <Select value={payForm.period_month} onValueChange={v => setPayForm(f => ({ ...f, period_month: v }))}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Year</Label>
                  <Select value={payForm.period_year} onValueChange={v => setPayForm(f => ({ ...f, period_year: v }))}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{[2023,2024,2025,2026,2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>}
              <div><Label>Transaction Ref / Cheque No</Label><Input className="h-11 mt-1" placeholder="UTR / Cheque number" value={payForm.transaction_ref} onChange={e => setPayForm(f => ({ ...f, transaction_ref: e.target.value }))} /></div>
              <div><Label>Bank Name</Label><Input className="h-11 mt-1" placeholder="e.g. SBI, HDFC" value={payForm.bank_name} onChange={e => setPayForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
            </div>

            {payForm.is_expense_claim && (
              <div className="p-3 border rounded-lg bg-amber-50 border-amber-200 space-y-3">
                <div className="flex items-center gap-2"><Switch checked={payForm.adjustment_in_maintenance} onCheckedChange={v => setPayForm(f => ({ ...f, adjustment_in_maintenance: v }))} /><Label>Adjust against my maintenance dues</Label></div>
                {!payForm.adjustment_in_maintenance && (
                  <Select value={payForm.reimbursement_mode} onValueChange={v => setPayForm(f => ({ ...f, reimbursement_mode: v }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Preferred refund method" /></SelectTrigger>
                    <SelectContent><SelectItem value="upi">UPI</SelectItem><SelectItem value="bank_transfer">NEFT/Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div><Label>Notes</Label><Textarea className="mt-1" rows={2} value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} /></div>

            <label className={`border-2 border-dashed rounded-lg p-4 cursor-pointer block ${payForm.attachment_file ? 'border-green-400 bg-green-50' : 'border-muted-foreground/30 hover:border-primary/50'}`}>
              <div className="flex items-center gap-3">
                <Upload className={`h-6 w-6 ${payForm.attachment_file ? 'text-green-600' : 'text-muted-foreground'}`} />
                <div><p className="font-medium text-sm">{payForm.attachment_file ? payForm.attachment_file.name : 'Upload Payment Proof *'}</p><p className="text-xs text-muted-foreground">Screenshot, PDF, or photo of receipt. Required.</p></div>
              </div>
              <Input type="file" className="hidden" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) setPayForm(p => ({ ...p, attachment_file: f })); }} />
            </label>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsPaymentOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => submitPayment.mutate()} disabled={submitPayment.isPending || !payForm.attachment_file || !payForm.amount || !payForm.payment_mode}>
                {submitPayment.isPending ? 'Submitting...' : <><ChevronsRight className="h-4 w-4 mr-1" />Submit for Approval</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── TENANT DIALOG ─────────────────────────────────────────────────────── */}
      <Dialog open={isTenantOpen} onOpenChange={setIsTenantOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editTenant ? 'Edit Tenant' : 'Add Tenant'}</DialogTitle><DialogDescription>Admin must approve before tenant gets access.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Flat *</Label>
              <Select value={tenantForm.flat_id} onValueChange={v => setTenantForm(f => ({ ...f, flat_id: v }))}>
                <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select flat" /></SelectTrigger>
                <SelectContent>{allFlats.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.wing ? `${f.wing}-` : ''}{f.flat_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Full Name *</Label><Input className="h-11 mt-1" value={tenantForm.full_name} onChange={e => setTenantForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div><Label>Mobile</Label><Input className="h-11 mt-1" value={tenantForm.mobile} onChange={e => setTenantForm(f => ({ ...f, mobile: e.target.value }))} /></div>
              <div><Label>Email</Label><Input className="h-11 mt-1" value={tenantForm.email} onChange={e => setTenantForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Aadhar (last 4)</Label><Input className="h-11 mt-1" maxLength={4} value={tenantForm.aadhar_masked} onChange={e => setTenantForm(f => ({ ...f, aadhar_masked: e.target.value }))} /></div>
              <div><Label>Monthly Rent (₹)</Label><Input type="number" className="h-11 mt-1" value={tenantForm.rent_amount} onChange={e => setTenantForm(f => ({ ...f, rent_amount: e.target.value }))} /></div>
              <div><Label>Deposit (₹)</Label><Input type="number" className="h-11 mt-1" value={tenantForm.deposit_amount} onChange={e => setTenantForm(f => ({ ...f, deposit_amount: e.target.value }))} /></div>
              <div><Label>Agreement From</Label><Input type="date" className="h-11 mt-1" value={tenantForm.validity_from} onChange={e => setTenantForm(f => ({ ...f, validity_from: e.target.value }))} /></div>
              <div><Label>Agreement To</Label><Input type="date" className="h-11 mt-1" value={tenantForm.validity_to} onChange={e => setTenantForm(f => ({ ...f, validity_to: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Native Address</Label><Textarea className="mt-1" rows={2} value={tenantForm.native_address} onChange={e => setTenantForm(f => ({ ...f, native_address: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsTenantOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveTenant.mutate()} disabled={saveTenant.isPending || !tenantForm.full_name || !tenantForm.flat_id}>{saveTenant.isPending ? 'Saving...' : 'Submit'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── FAMILY DIALOG ─────────────────────────────────────────────────────── */}
      <Dialog open={isFamilyOpen} onOpenChange={o => { if (!o) { setIsFamilyOpen(false); setEditFamilyMember(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editFamilyMember ? 'Edit Family Member' : 'Add Family Member'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={familyPhotoFile ? URL.createObjectURL(familyPhotoFile) : familyForm.photo_url || undefined} />
                <AvatarFallback>{familyForm.name?.charAt(0) || '?'}</AvatarFallback>
              </Avatar>
              <label className="cursor-pointer"><Button variant="outline" size="sm" asChild><span><Camera className="h-4 w-4 mr-1" />Upload Photo</span></Button><input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setFamilyPhotoFile(f); }} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input className="h-11 mt-1" value={familyForm.name} onChange={e => setFamilyForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div>
                <Label>Relation</Label>
                <Select value={familyForm.relation} onValueChange={v => setFamilyForm(f => ({ ...f, relation: v }))}>
                  <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{['Spouse','Son','Daughter','Father','Mother','Brother','Sister','Grandfather','Grandmother','Other'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date of Birth</Label><Input type="date" className="h-11 mt-1" value={familyForm.date_of_birth} onChange={e => setFamilyForm(f => ({ ...f, date_of_birth: e.target.value }))} /></div>
              <div>
                <Label>Blood Group</Label>
                <Select value={familyForm.blood_group} onValueChange={v => setFamilyForm(f => ({ ...f, blood_group: v }))}>
                  <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Blood group" /></SelectTrigger>
                  <SelectContent>{BLOOD_GROUPS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Education</Label><Input className="h-11 mt-1" placeholder="e.g. B.Tech, MBA" value={familyForm.education} onChange={e => setFamilyForm(f => ({ ...f, education: e.target.value }))} /></div>
              <div><Label>Occupation / Job</Label><Input className="h-11 mt-1" placeholder="e.g. Software Engineer" value={familyForm.occupation} onChange={e => setFamilyForm(f => ({ ...f, occupation: e.target.value }))} /></div>
              <div><Label>Employer / Business</Label><Input className="h-11 mt-1" value={familyForm.employer} onChange={e => setFamilyForm(f => ({ ...f, employer: e.target.value }))} /></div>
              <div><Label>Contact Number</Label><Input className="h-11 mt-1" value={familyForm.contact_number} onChange={e => setFamilyForm(f => ({ ...f, contact_number: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" className="h-11 mt-1" value={familyForm.email} onChange={e => setFamilyForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2 p-2 border rounded"><Switch checked={familyForm.is_dependent} onCheckedChange={v => setFamilyForm(f => ({ ...f, is_dependent: v }))} /><Label>Dependent member (lives in same flat)</Label></div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsFamilyOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => saveFamilyMutation.mutate()} disabled={!familyForm.name || saveFamilyMutation.isPending}>{saveFamilyMutation.isPending ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CHANGE PASSWORD ───────────────────────────────────────────────────── */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>New Password</Label><Input type="password" className="h-11 mt-1" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} /></div>
            <div><Label>Confirm Password</Label><Input type="password" className="h-11 mt-1" value={pwForm.confirmPw} onChange={e => setPwForm(f => ({ ...f, confirmPw: e.target.value }))} /></div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsPasswordOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => changePw.mutate()} disabled={changePw.isPending}>{changePw.isPending ? 'Saving...' : 'Change'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── EDIT FLAT STATUS ─────────────────────────────────────────────────── */}
      <Dialog open={!!editFlatStatus} onOpenChange={o => !o && setEditFlatStatus(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Flat Status</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={editFlatStatus?.currentStatus} onValueChange={v => setEditFlatStatus((f: any) => ({ ...f, currentStatus: v }))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{FLAT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditFlatStatus(null)}>Cancel</Button>
              <Button className="flex-1" onClick={() => updateFlatStatus.mutate({ flatId: editFlatStatus.flatId, status: editFlatStatus.currentStatus })} disabled={updateFlatStatus.isPending}>{updateFlatStatus.isPending ? 'Saving...' : 'Update'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
