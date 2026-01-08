import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Shield, Plus, Edit, Trash2, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Role {
    id: string;
    name: string;
    description: string;
    is_system_role: boolean;
}

interface Permission {
    id: string;
    code: string;
    name: string;
    module: string;
}

const RolesPage = () => {
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

    // Fetch Roles
    const { data: roles = [], isLoading: rolesLoading } = useQuery({
        queryKey: ['app-roles'],
        queryFn: async () => {
            const { data, error } = await supabase.from('app_roles').select('*').order('name');
            if (error) throw error;
            return data as Role[];
        },
    });

    // Fetch Permissions
    const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
        queryKey: ['all-permissions'],
        queryFn: async () => {
            const { data, error } = await supabase.from('permissions').select('*').order('module, name');
            if (error) throw error;
            return data as Permission[];
        },
    });

    // Fetch Role Permissions when editing
    const { data: rolePermissions = [] } = useQuery({
        queryKey: ['role-permissions', selectedRole?.id],
        enabled: !!selectedRole,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('permission_id')
                .eq('role_id', selectedRole?.id);
            if (error) throw error;
            return data.map(rp => rp.permission_id);
        },
    });

    // Update selected permissions when role permissions load
    // Use useEffect instead of useState for side effects
    // Update selected permissions when role permissions load
    useEffect(() => {
        if (rolePermissions) {
            setSelectedPermissions(rolePermissions);
        }
    }, [rolePermissions]);

    // Let's use useEffect to update local state when data comes in
    // But only if we just opened the dialog or switched roles
    // Actually, the issue might be that `rolePermissions` query runs, returns data, but `selectedPermissions` isn't updated because `useState` initializer only runs once.

    // Fix:
    // 1. Remove the `useState(() => ...)` block.
    // 2. Add `useEffect` to sync `rolePermissions` to `selectedPermissions`.

    /* 
    useEffect(() => {
        if (rolePermissions) {
            setSelectedPermissions(rolePermissions);
        }
    }, [rolePermissions]);
    */

    // However, if user unchecks something, `rolePermissions` (server state) doesn't change, so `selectedPermissions` (local state) is fine.
    // But if they close and reopen, we need to reset.

    // Let's simplify: When clicking edit, we set selectedRole. The query runs. When query returns, we update state.

    // Create Role Mutation
    const createRoleMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase
                .from('app_roles')
                .insert({ name: roleName, description: roleDescription })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app-roles'] });
            setIsCreateOpen(false);
            resetForm();
            toast.success('تم إنشاء الدور بنجاح');
        },
        onError: (error: any) => toast.error(`فشل إنشاء الدور: ${error.message}`),
    });

    // Update Role Permissions Mutation
    const updateRolePermissionsMutation = useMutation({
        mutationFn: async ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => {
            // 1. Delete existing permissions
            const { error: deleteError } = await supabase
                .from('role_permissions')
                .delete()
                .eq('role_id', roleId);
            if (deleteError) throw deleteError;

            // 2. Insert new permissions
            if (permissionIds.length > 0) {
                const { error: insertError } = await supabase
                    .from('role_permissions')
                    .insert(permissionIds.map(pid => ({ role_id: roleId, permission_id: pid })));
                if (insertError) throw insertError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
            setIsEditOpen(false);
            toast.success('تم تحديث صلاحيات الدور بنجاح');
        },
        onError: (error: any) => toast.error(`فشل تحديث الصلاحيات: ${error.message}`),
    });

    const handleEditClick = (role: Role) => {
        setSelectedRole(role);
        setRoleName(role.name);
        setRoleDescription(role.description || '');
        // We don't set permissions here because we wait for the query
        setIsEditOpen(true);
    };

    // Add this useEffect
    // Removed redundant useEffect

    const handleSavePermissions = () => {
        if (!selectedRole) return;
        updateRolePermissionsMutation.mutate({
            roleId: selectedRole.id,
            permissionIds: selectedPermissions,
        });
    };

    const resetForm = () => {
        setRoleName('');
        setRoleDescription('');
        setSelectedPermissions([]);
        setSelectedRole(null);
    };

    // Group permissions by module
    const permissionsByModule = permissions.reduce((acc, perm) => {
        if (!acc[perm.module]) acc[perm.module] = [];
        acc[perm.module].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Shield className="h-8 w-8" />
                        إدارة الأدوار والصلاحيات
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        إنشاء وتعديل الأدوار وتعيين الصلاحيات
                    </p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    إضافة دور جديد
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>الأدوار المتاحة</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">اسم الدور</TableHead>
                                <TableHead className="text-right">الوصف</TableHead>
                                <TableHead className="text-right">نوع الدور</TableHead>
                                <TableHead className="text-right">الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {roles.map((role) => (
                                <TableRow key={role.id}>
                                    <TableCell className="font-medium">{role.name}</TableCell>
                                    <TableCell>{role.description}</TableCell>
                                    <TableCell>
                                        {role.is_system_role ? (
                                            <Badge variant="secondary">نظام</Badge>
                                        ) : (
                                            <Badge variant="outline">مخصص</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(role)}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            تعديل الصلاحيات
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create Role Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>إضافة دور جديد</DialogTitle>
                        <DialogDescription>
                            قم بإدخال تفاصيل الدور الجديد أدناه.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>اسم الدور</Label>
                            <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="مثال: محاسب" />
                        </div>
                        <div className="space-y-2">
                            <Label>الوصف</Label>
                            <Input value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="وصف مختصر للدور" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>إلغاء</Button>
                        <Button onClick={() => createRoleMutation.mutate()} disabled={!roleName}>حفظ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Permissions Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>تعديل صلاحيات: {selectedRole?.name}</DialogTitle>
                        <DialogDescription>
                            قم بتحديد الصلاحيات التي تريد منحها لهذا الدور.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
                            <div key={module} className="space-y-3">
                                <h3 className="font-semibold text-lg border-b pb-2">{module}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {modulePermissions.map((perm) => (
                                        <div key={perm.id} className="flex items-start space-x-2 space-x-reverse">
                                            <Checkbox
                                                id={perm.id}
                                                checked={selectedPermissions.includes(perm.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedPermissions([...selectedPermissions, perm.id]);
                                                    } else {
                                                        setSelectedPermissions(selectedPermissions.filter(id => id !== perm.id));
                                                    }
                                                }}
                                            />
                                            <div className="grid gap-1.5 leading-none mr-2">
                                                <Label htmlFor={perm.id} className="cursor-pointer font-medium">
                                                    {perm.name}
                                                </Label>
                                                <p className="text-sm text-muted-foreground">
                                                    {perm.code}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSavePermissions}>حفظ التغييرات</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RolesPage;
