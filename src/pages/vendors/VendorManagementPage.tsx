import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadPrivateFile } from '@/lib/fileStorage';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { Plus, Search, Edit, Trash2, Building2, Phone, Mail, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const SERVICE_CATEGORIES = ['Electrical','Plumbing','Civil/Construction','Security','Cleaning','Gardening','Lift Maintenance','Pest Control','CCTV/IT','Fire Safety','Water Treatment','Generator/DG','Catering','Event Management','Legal/CA','Other'];
const emptyVendor = { vendor_name:'',contact_person:'',address:'',city:'',state:'',mobile:'',phone:'',email:'',gst_number:'',pan_number:'',aadhar_masked:'',bank_name:'',bank_account:'',bank_ifsc:'',services_provided:[] as string[],service_description:'',contract_start_date:'',contract_end_date:'',contract_amount:'',notes:'',is_active:true };

export default function VendorManagementPage() {
  const { currentSocietyId } = useAuthStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search,setSearch]=useState('');
  const [isFormOpen,setIsFormOpen]=useState(false);
  const [editVendor,setEditVendor]=useState<any>(null);
  const [form,setForm]=useState(emptyVendor);
  const [contractFile,setContractFile]=useState<File|null>(null);

  const { data:vendors,isLoading } = useQuery({
    queryKey:['vendors',currentSocietyId],
    queryFn:async()=>{
      if(!currentSocietyId)return[];
      const{data,error}=await supabase.from('vendors').select('*').eq('society_id',currentSocietyId).order('vendor_name');
      if(error)throw error; return data||[];
    },enabled:!!currentSocietyId
  });

  const filtered=vendors?.filter(v=>v.vendor_name.toLowerCase().includes(search.toLowerCase())||(v.contact_person||'').toLowerCase().includes(search.toLowerCase()))||([] as any[]);

  const saveVendor=useMutation({
    mutationFn:async()=>{
      if(!form.vendor_name)throw new Error('Vendor name required');
      let contractUrl=editVendor?.contract_document_url||null;
      if(contractFile){
        const saved = await uploadPrivateFile({
          file: contractFile,
          societyId: currentSocietyId!,
          category: 'Vendor Contract',
        });
        contractUrl = `php://${saved.id}`;
      }
      const payload={...form,society_id:currentSocietyId,contract_amount:form.contract_amount?Number(form.contract_amount):null,contract_start_date:form.contract_start_date||null,contract_end_date:form.contract_end_date||null,contract_document_url:contractUrl};
      if(editVendor){const{error}=await supabase.from('vendors').update(payload).eq('id',editVendor.id);if(error)throw error;}
      else{const{error}=await supabase.from('vendors').insert(payload);if(error)throw error;}
    },
    onSuccess:()=>{qc.invalidateQueries({queryKey:['vendors']});toast({title:editVendor?'Updated':'Added'});setIsFormOpen(false);setEditVendor(null);setForm(emptyVendor);setContractFile(null);},
    onError:(e:any)=>toast({title:'Error',description:e.message,variant:'destructive'})
  });

  const openEdit=(v:any)=>{setEditVendor(v);setForm({vendor_name:v.vendor_name||'',contact_person:v.contact_person||'',address:v.address||'',city:v.city||'',state:v.state||'',mobile:v.mobile||'',phone:v.phone||'',email:v.email||'',gst_number:v.gst_number||'',pan_number:v.pan_number||'',aadhar_masked:v.aadhar_masked||'',bank_name:v.bank_name||'',bank_account:v.bank_account||'',bank_ifsc:v.bank_ifsc||'',services_provided:v.services_provided||[],service_description:v.service_description||'',contract_start_date:v.contract_start_date||'',contract_end_date:v.contract_end_date||'',contract_amount:v.contract_amount?String(v.contract_amount):'',notes:v.notes||'',is_active:v.is_active??true});setIsFormOpen(true);};

  const isExpired=(end:string|null)=>end&&new Date(end)<new Date();
  const isNearExpiry=(end:string|null)=>{if(!end)return false;const diff=(new Date(end).getTime()-new Date().getTime())/(86400000);return diff>=0&&diff<=30;};
  const expiredContracts=vendors?.filter(v=>v.is_active&&isExpired(v.contract_end_date))||[];
  const nearExpiry=vendors?.filter(v=>v.is_active&&isNearExpiry(v.contract_end_date))||[];

  return(
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6"/>Vendor Management</h1><p className="text-muted-foreground">Manage vendors, contracts and service providers</p></div>
        <Button onClick={()=>{setEditVendor(null);setForm(emptyVendor);setIsFormOpen(true);}}><Plus className="mr-2 h-4 w-4"/>Add Vendor</Button>
      </div>
      {expiredContracts.map(v=>(
        <div key={v.id} className="flex items-center gap-2 p-3 border border-red-300 bg-red-50 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-600"/><p className="text-sm text-red-700"><strong>{v.vendor_name}</strong> — contract expired on {format(new Date(v.contract_end_date!),'dd MMM yyyy')}</p>
        </div>
      ))}
      {nearExpiry.map(v=>(
        <div key={v.id} className="flex items-center gap-2 p-3 border border-amber-300 bg-amber-50 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600"/><p className="text-sm text-amber-700"><strong>{v.vendor_name}</strong> — contract expires {format(new Date(v.contract_end_date!),'dd MMM yyyy')} (within 30 days)</p>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input placeholder="Search vendors..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9"/></div>
        <Badge variant="outline">{filtered.length} vendors</Badge>
      </div>
      <Card><CardContent className="p-0">
        {isLoading?<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/></div>:filtered.length===0?
          <div className="text-center py-16"><Building2 className="mx-auto h-12 w-12 text-muted-foreground/40"/><p className="mt-3 text-muted-foreground">No vendors yet</p><Button className="mt-4" onClick={()=>setIsFormOpen(true)}><Plus className="mr-2 h-4 w-4"/>Add First Vendor</Button></div>:
          <Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Services</TableHead><TableHead>Contact</TableHead><TableHead>Contract</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map((v:any)=>(
              <TableRow key={v.id}>
                <TableCell><div><p className="font-medium">{v.vendor_name}</p>{v.contact_person&&<p className="text-xs text-muted-foreground">{v.contact_person}</p>}{v.city&&<p className="text-xs text-muted-foreground">{v.city}</p>}</div></TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{(v.services_provided||[]).slice(0,2).map((s:string)=><Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}{(v.services_provided||[]).length>2&&<Badge variant="outline" className="text-xs">+{(v.services_provided||[]).length-2}</Badge>}</div></TableCell>
                <TableCell>{v.mobile&&<p className="text-sm flex items-center gap-1"><Phone className="h-3 w-3"/>{v.mobile}</p>}{v.email&&<p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3"/>{v.email}</p>}</TableCell>
                <TableCell>{v.contract_end_date?<div><p className={`text-xs font-medium ${isExpired(v.contract_end_date)?'text-red-600':isNearExpiry(v.contract_end_date)?'text-amber-600':'text-green-600'}`}>{isExpired(v.contract_end_date)?'⚠ Expired':isNearExpiry(v.contract_end_date)?'⚠ Expiring':'✓ Active'}</p><p className="text-xs text-muted-foreground">Till {format(new Date(v.contract_end_date),'dd MMM yy')}</p>{v.contract_amount&&<p className="text-xs">₹{Number(v.contract_amount).toLocaleString('en-IN')}</p>}</div>:<span className="text-xs text-muted-foreground">No contract</span>}</TableCell>
                <TableCell><Badge variant={v.is_active?'default':'secondary'}>{v.is_active?'Active':'Inactive'}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex gap-1 justify-end">{v.contract_document_url&&<a href={v.contract_document_url} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon"><FileText className="h-4 w-4"/></Button></a>}<Button variant="ghost" size="icon" onClick={()=>openEdit(v)}><Edit className="h-4 w-4"/></Button></div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>}
      </CardContent></Card>

      <Dialog open={isFormOpen} onOpenChange={o=>{if(!o){setIsFormOpen(false);setEditVendor(null);}}}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editVendor?'Edit':'Add'} Vendor</DialogTitle><DialogDescription>Vendor master — used when booking expenses</DialogDescription></DialogHeader>
          <Tabs defaultValue="basic">
            <TabsList><TabsTrigger value="basic">Basic Info</TabsTrigger><TabsTrigger value="financial">Financial</TabsTrigger><TabsTrigger value="contract">Contract</TabsTrigger></TabsList>
            <TabsContent value="basic" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Vendor Name *</Label><Input className="h-11 mt-1" value={form.vendor_name} onChange={e=>setForm(f=>({...f,vendor_name:e.target.value}))}/></div>
                <div><Label>Contact Person</Label><Input className="h-11 mt-1" value={form.contact_person} onChange={e=>setForm(f=>({...f,contact_person:e.target.value}))}/></div>
                <div><Label>Mobile</Label><Input className="h-11 mt-1" value={form.mobile} onChange={e=>setForm(f=>({...f,mobile:e.target.value}))}/></div>
                <div><Label>Email</Label><Input type="email" className="h-11 mt-1" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
                <div><Label>City</Label><Input className="h-11 mt-1" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/></div>
                <div className="col-span-2"><Label>Address</Label><Textarea className="mt-1" rows={2} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/></div>
              </div>
              <div><Label>Services</Label><div className="mt-2 grid grid-cols-3 gap-1">{SERVICE_CATEGORIES.map(s=><label key={s} className="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" checked={form.services_provided.includes(s)} onChange={e=>setForm(f=>({...f,services_provided:e.target.checked?[...f.services_provided,s]:f.services_provided.filter(x=>x!==s)}))}/>{s}</label>)}</div></div>
            </TabsContent>
            <TabsContent value="financial" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>GST Number</Label><Input className="h-11 mt-1" value={form.gst_number} onChange={e=>setForm(f=>({...f,gst_number:e.target.value}))}/></div>
                <div><Label>PAN</Label><Input className="h-11 mt-1" value={form.pan_number} onChange={e=>setForm(f=>({...f,pan_number:e.target.value}))}/></div>
                <div><Label>Bank Name</Label><Input className="h-11 mt-1" value={form.bank_name} onChange={e=>setForm(f=>({...f,bank_name:e.target.value}))}/></div>
                <div><Label>Account No</Label><Input className="h-11 mt-1" value={form.bank_account} onChange={e=>setForm(f=>({...f,bank_account:e.target.value}))}/></div>
                <div><Label>IFSC</Label><Input className="h-11 mt-1" value={form.bank_ifsc} onChange={e=>setForm(f=>({...f,bank_ifsc:e.target.value}))}/></div>
              </div>
            </TabsContent>
            <TabsContent value="contract" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" className="h-11 mt-1" value={form.contract_start_date} onChange={e=>setForm(f=>({...f,contract_start_date:e.target.value}))}/></div>
                <div><Label>End Date</Label><Input type="date" className="h-11 mt-1" value={form.contract_end_date} onChange={e=>setForm(f=>({...f,contract_end_date:e.target.value}))}/></div>
                <div><Label>Amount (₹)</Label><Input type="number" className="h-11 mt-1" value={form.contract_amount} onChange={e=>setForm(f=>({...f,contract_amount:e.target.value}))}/></div>
              </div>
              <div><Label>Contract Document</Label><label className="mt-1 block cursor-pointer border-2 border-dashed rounded p-3"><p className="text-sm">{contractFile?contractFile.name:editVendor?.contract_document_url?'✓ Document uploaded':'Upload PDF/image'}</p><input type="file" className="hidden" accept=".pdf,image/*" onChange={e=>setContractFile(e.target.files?.[0]||null)}/></label></div>
              <div><Label>Notes</Label><Textarea className="mt-1" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
            </TabsContent>
          </Tabs>
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" className="flex-1" onClick={()=>setIsFormOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={()=>saveVendor.mutate()} disabled={saveVendor.isPending||!form.vendor_name}>{saveVendor.isPending?'Saving...':editVendor?'Update':'Add Vendor'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
