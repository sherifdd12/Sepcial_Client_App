import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, User, Clock, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UserRole {
  user_id: string;
  role: string;
  created_at: string;
}

interface AppRole {
  id: string;
  name: string;
  description: string;
}

const fetchAllUserRoles = async (): Promise<UserRole[]> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as any || [];
};

const updateUserRole = async ({ userId, newRole }: { userId: string; newRole: string }) => {
  const { error } = await supabase
    .from('user_roles')
    .update({ role: newRole as any })
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
};

const UsersPage = () => {
  const queryClient = useQueryClient();
  const [userEmails, setUserEmails] = useState<{ [key: string]: string }>({});

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['user-roles'],
    queryFn: fetchAllUserRoles,
  });

  // Fetch available roles from app_roles
  const { data: availableRoles = [] } = useQuery({
    queryKey: ['app-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_roles').select('*').order('name');
      if (error) throw error;
      return data as AppRole[];
    },
  });

  // Fetch email for each user
  useEffect(() => {
    const fetchUserEmails = async () => {
      try {
        // First try to fetch from profiles if it exists
        const { data: profiles, error: profilesError } = await (supabase as any)
          .from('profiles')
          .select('id, email, full_name');

        if (!profilesError && profiles) {
          const emailMap: { [key: string]: string } = {};
          profiles.forEach((profile: any) => {
            emailMap[profile.id] = profile.email || 'Unknown';
          });
          setUserEmails(emailMap);
          return;
        }

        // Fallback to admin API
        const { data, error } = await supabase.auth.admin.listUsers();

        if (error) throw error;

        if (data && data.users) {
          const emailMap: { [key: string]: string } = {};
          data.users.forEach((user: any) => {
            emailMap[user.id] = user.email || 'Unknown';
          });
          setUserEmails(prev => ({ ...prev, ...emailMap }));
        }
      } catch (err) {
        console.log('Could not fetch user emails', err);
      }
    };

    if (users.length > 0) {
      fetchUserEmails();
    }
  }, [users]);

  const updateRoleMutation = useMutation({
    mutationFn: updateUserRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('تم تحديث صلاحيات المستخدم بنجاح');
    },
    onError: (error: Error) => {
      toast.error(`فشل تحديث الصلاحيات: ${error.message}`);
    },
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, newRole });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500"><Shield className="h-3 w-3 mr-1" />مدير</Badge>;
      case 'staff':
        return <Badge variant="secondary"><User className="h-3 w-3 mr-1" />موظف</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />بانتظار الموافقة</Badge>;
      default:
        // Try to find role description or name
        const appRole = availableRoles.find(r => r.name === role);
        return <Badge variant="outline" className="border-blue-500 text-blue-500">
          <User className="h-3 w-3 mr-1" />
          {appRole?.description || role}
        </Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">جاري تحميل المستخدمين...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-destructive">خطأ في تحميل المستخدمين: {error.message}</div>
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.role === 'pending');
  const approvedUsers = users.filter(u => u.role !== 'pending');

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8" />
            إدارة المستخدمين
          </h1>
          <p className="text-muted-foreground mt-2">
            الموافقة على المستخدمين الجدد وإدارة صلاحيات المستخدمين
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/roles">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              إدارة الأدوار
            </Button>
          </Link>
          <Button onClick={() => toast.info("لإضافة مستخدم جديد، يرجى استخدام لوحة تحكم Supabase أو دعوته عبر الرابط المخصص إذا كان متاحاً.")}>
            <User className="mr-2 h-4 w-4" />
            إضافة مستخدم جديد
          </Button>
        </div>
      </div>

      {pendingUsers.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              طلبات الموافقة ({pendingUsers.length})
            </CardTitle>
            <CardDescription>
              مستخدمون جدد بانتظار الموافقة على حساباتهم
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المعرف / البريد الإلكتروني</TableHead>
                  <TableHead className="text-right">تاريخ التسجيل</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">
                      {userEmails[user.user_id] || user.user_id}
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString('ar-EG')}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRoleChange(user.user_id, 'staff')}
                          disabled={updateRoleMutation.isPending}
                        >
                          الموافقة كموظف
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRoleChange(user.user_id, 'admin')}
                          disabled={updateRoleMutation.isPending}
                        >
                          الموافقة كمدير
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>جميع المستخدمين ({approvedUsers.length})</CardTitle>
          <CardDescription>
            إدارة صلاحيات المستخدمين المعتمدين
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvedUsers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              لا يوجد مستخدمون معتمدون حالياً
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المعرف / البريد الإلكتروني</TableHead>
                  <TableHead className="text-right">تاريخ الانضمام</TableHead>
                  <TableHead className="text-right">الدور الحالي</TableHead>
                  <TableHead className="text-right">تغيير الدور</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">
                      {userEmails[user.user_id] || user.user_id}
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString('ar-EG')}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.user_id, value)}
                        disabled={updateRoleMutation.isPending}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map(role => (
                            <SelectItem key={role.id} value={role.name}>
                              <div className="flex flex-col items-start text-right">
                                <span className="font-medium">{role.name}</span>
                                {role.description && (
                                  <span className="text-xs text-muted-foreground">{role.description}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                          <SelectItem value="pending">
                            <div className="flex flex-col items-start text-right">
                              <span className="font-medium">بانتظار الموافقة</span>
                              <span className="text-xs text-muted-foreground">حساب جديد</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersPage;
