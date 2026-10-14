import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { uploadPrivateFile, isPrivateFile, openPrivateFile, downloadPrivateFile } from '@/lib/fileStorage';
import { PrivateFileButton } from '@/components/common/PrivateFileButton';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { Plus, FileArchive, Search, Trash2, MoreHorizontal, Download, Eye, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';

const categories = [
  'Registration',
  'Minutes of Meeting',
  'Financial Report',
  'Audit Report',
  'Society Rules',
  'Insurance',
  'Legal',
  'NOC',
  'Other',
] as const;

const docSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  file_name: z.string().min(1, 'File name is required'),
});

type DocFormValues = z.infer<typeof docSchema>;

export default function DocumentsPage() {
  const { currentSocietyId, user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', currentSocietyId],
    queryFn: async () => {
      if (!currentSocietyId) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('society_id', currentSocietyId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentSocietyId,
  });

  const form = useForm<DocFormValues>({
    resolver: zodResolver(docSchema),
    defaultValues: { category: '', file_name: '' },
  });

  const uploadMutation = useMutation({
    mutationFn: async (values: DocFormValues) => {
      if (!currentSocietyId || !selectedFile) throw new Error('No file selected');

      // Stored privately on Hostinger, outside the webroot. upload.php also
      // writes the documents row, so there is no separate insert here.
      await uploadPrivateFile({
        file: selectedFile,
        societyId: currentSocietyId,
        category: values.category || 'Other',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document uploaded' });
      setIsFormOpen(false);
      setSelectedFile(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document deleted' });
      setDeleteItem(null);
    },
  });

  const filtered = documents?.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = activeCategory === 'all' || d.category === activeCategory;
    return matchSearch && matchCategory;
  });

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const categoryCounts = categories.map(c => ({
    name: c,
    count: documents?.filter(d => d.category === c).length || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Management</h1>
          <p className="text-muted-foreground">Upload and manage society documents</p>
        </div>
        <Button onClick={() => { form.reset(); setSelectedFile(null); setIsFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Upload Document
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileArchive className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{documents?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {categoryCounts.filter(c => c.count > 0).slice(0, 3).map(c => (
          <Card key={c.name} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveCategory(c.name)}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{c.count}</p>
              <p className="text-sm text-muted-foreground">{c.name}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 text-base" />
            </div>
            <Select value={activeCategory} onValueChange={setActiveCategory}>
              <SelectTrigger className="w-[200px] h-12">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>{filtered?.length || 0} documents found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <FileArchive className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No documents found</h3>
              <p className="text-muted-foreground">Upload your first document</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered?.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.file_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{doc.category}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatSize(doc.file_size)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.uploaded_at ? format(new Date(doc.uploaded_at), 'dd MMM yyyy') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isPrivateFile(doc.file_url) ? (
                                <>
                                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openPrivateFile(doc.id).catch((err) => toast({ title: 'Could not open file', description: err.message, variant: 'destructive' })); }}>
                                    <Eye className="mr-2 h-4 w-4" /> View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); downloadPrivateFile(doc.id, doc.file_name).catch((err) => toast({ title: 'Could not download file', description: err.message, variant: 'destructive' })); }}>
                                    <Download className="mr-2 h-4 w-4" /> Download
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
                                  <DropdownMenuItem asChild>
                                    <a href={doc.file_url} target="_blank" rel="noreferrer">
                                      <Eye className="mr-2 h-4 w-4" /> View
                                    </a>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <a href={doc.file_url} download>
                                      <Download className="mr-2 h-4 w-4" /> Download
                                    </a>
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem onClick={() => setDeleteItem(doc)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3">
                {filtered?.map(doc => (
                  <Card key={doc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{doc.file_name}</h3>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary">{doc.category}</Badge>
                            <span className="text-xs text-muted-foreground">{formatSize(doc.file_size)}</span>
                          </div>
                        </div>
                        {isPrivateFile(doc.file_url) ? (
                          <Button variant="ghost" size="icon" onClick={() => openPrivateFile(doc.id).catch((err) => toast({ title: 'Could not open file', description: err.message, variant: 'destructive' }))}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload a new document to the society records</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => uploadMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12"><SelectValue placeholder="Select category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="file_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Name *</FormLabel>
                  <FormControl><Input placeholder="e.g., AGM Minutes 2025" className="h-12" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div>
                <label className="text-sm font-medium">File *</label>
                <div className="mt-1">
                  <label className="flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-3 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" />
                    {selectedFile?.name || 'Choose file to upload'}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} className="flex-1 h-12">Cancel</Button>
                <Button type="submit" className="flex-1 h-12" disabled={uploadMutation.isPending || !selectedFile}>
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
