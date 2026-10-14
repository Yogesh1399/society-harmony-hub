import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useSocietyStore } from '@/stores/societyStore';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building, Users, TrendingUp, TrendingDown, Plus, Shield, Activity,
  ArrowRight, CheckCircle2, XCircle, MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { setCurrentSocietyId } = useAuthStore();
  const { setCurrentSociety, setFeatures } = useSocietyStore();

  const { data: societies, isLoading } = useQuery({
    queryKey: ['all_societies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('societies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: totalMembers } = useQuery({
    queryKey: ['total_members'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: totalFlats } = useQuery({
    queryKey: ['total_flats'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('flats')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: totalIncome } = useQuery({
    queryKey: ['total_income_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('income_entries')
        .select('total_amount')
        .eq('is_cancelled', false);
      if (error) throw error;
      return data?.reduce((s, e) => s + Number(e.total_amount), 0) || 0;
    },
  });

  const queryClient = useQueryClient();

  const handleSocietyClick = async (society: any) => {
    setCurrentSocietyId(society.id);
    setCurrentSociety(society);
    // Fetch features for this society
    const { data: features } = await supabase
      .from('feature_settings')
      .select('*')
      .eq('society_id', society.id)
      .single();
    if (features) setFeatures(features);
    // Clear cached data belonging to the previously selected society
    await queryClient.invalidateQueries();
    navigate('/dashboard');
  };

  const activeSocieties = societies?.filter(s => s.is_active).length || 0;
  const inactiveSocieties = societies?.filter(s => !s.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Super Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Platform overview and society management</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/super-admin/users')}>
            <Users className="mr-2 h-4 w-4" /> Users
          </Button>
          <Button variant="outline" onClick={() => navigate('/super-admin/support')}>
            <MessageSquare className="mr-2 h-4 w-4" /> Support
          </Button>
          <Button onClick={() => navigate('/super-admin/societies')} size="lg">
            <Plus className="mr-2 h-4 w-4" /> Register Society
          </Button>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{societies?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Societies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <Users className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMembers}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Activity className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFlats}</p>
                <p className="text-sm text-muted-foreground">Total Flats</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalIncome || 0)}</p>
                <p className="text-sm text-muted-foreground">Platform Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-primary">{activeSocieties}</p>
              <p className="text-sm text-muted-foreground">Active Societies</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-primary/50" />
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-destructive">{inactiveSocieties}</p>
              <p className="text-sm text-muted-foreground">Inactive Societies</p>
            </div>
            <XCircle className="h-8 w-8 text-destructive/50" />
          </CardContent>
        </Card>
      </div>

      {/* Societies Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Societies</CardTitle>
              <CardDescription>Click on a society name to manage it</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate('/super-admin/societies')}>
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : societies?.length === 0 ? (
            <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No societies registered</h3>
              <p className="text-muted-foreground mb-4">Get started by registering your first society</p>
              <Button onClick={() => navigate('/super-admin/societies')}>
                <Plus className="mr-2 h-4 w-4" /> Register Society
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Society Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {societies?.map((society) => (
                    <TableRow key={society.id} className="cursor-pointer hover:bg-accent/50">
                      <TableCell>
                        <button
                          onClick={() => handleSocietyClick(society)}
                          className="font-semibold text-primary hover:underline text-left"
                        >
                          {society.name}
                        </button>
                        {society.registration_no && (
                          <p className="text-xs text-muted-foreground">Reg: {society.registration_no}</p>
                        )}
                      </TableCell>
                      <TableCell>{society.city || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {society.package_type || 'basic'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={society.is_active ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}>
                          {society.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {society.created_at ? format(new Date(society.created_at), 'dd MMM yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSocietyClick(society)}
                        >
                          Manage <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
