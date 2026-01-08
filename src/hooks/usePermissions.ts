import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Permission {
    code: string;
    name: string;
    module: string;
}

export const usePermissions = () => {
    const { user, isLoading: isAuthLoading } = useAuth();

    const { data: permissions = [], isLoading: isQueryLoading, error } = useQuery({
        queryKey: ['user-permissions', user?.id],
        queryFn: async () => {
            if (!user) return [];

            // Get user roles (handle multiple)
            const { data: userRoles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id);

            if (!userRoles || userRoles.length === 0) return [];

            const roleNames = userRoles.map(r => r.role);

            // Get app_roles IDs
            const { data: appRoles } = await supabase
                .from('app_roles')
                .select('id')
                .in('name', roleNames);

            if (!appRoles || appRoles.length === 0) return [];

            const appRoleIds = appRoles.map(r => r.id);

            // Get permissions for all roles
            const { data: perms } = await supabase
                .from('role_permissions')
                .select(`
                  permissions (
                    code,
                    name,
                    module
                  )
                `)
                .in('role_id', appRoleIds);

            const allPermissions = perms?.map((p: any) => p.permissions) as Permission[] || [];

            // Deduplicate permissions by code
            const uniquePermissions = Array.from(new Map(allPermissions.map(p => [p.code, p])).values());

            return uniquePermissions;
        },
        staleTime: 0, // Always fetch fresh permissions
        refetchOnWindowFocus: true,
        enabled: !isAuthLoading && !!user, // Only fetch when auth is ready and user exists
    });

    const isLoading = isAuthLoading || (!!user && isQueryLoading);

    const hasPermission = (permissionCode: string) => {
        if (isLoading) return false;
        return permissions.some(p => p.code === permissionCode);
    };

    const hasAnyPermission = (permissionCodes: string[]) => {
        if (isLoading) return false;
        return permissions.some(p => permissionCodes.includes(p.code));
    };

    return {
        permissions,
        isLoading,
        error,
        hasPermission,
        hasAnyPermission
    };
};
