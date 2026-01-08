import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGuardProps {
    children: ReactNode;
    permission: string | string[];
    requireAll?: boolean;
    fallback?: ReactNode;
}

export const PermissionGuard = ({
    children,
    permission,
    requireAll = false,
    fallback = null
}: PermissionGuardProps) => {
    const { hasPermission, hasAnyPermission, isLoading } = usePermissions();

    if (isLoading) {
        return <div className="p-4 text-center text-muted-foreground">جاري التحقق من الصلاحيات...</div>;
    }

    const permissionsToCheck = Array.isArray(permission) ? permission : [permission];

    let hasAccess = false;
    if (requireAll) {
        hasAccess = permissionsToCheck.every(p => hasPermission(p));
    } else {
        hasAccess = hasAnyPermission(permissionsToCheck);
    }

    if (!hasAccess) {
        if (fallback) return <>{fallback}</>;
        return (
            <div className="p-8 text-center text-red-500">
                <h3 className="text-lg font-bold">تم رفض الوصول</h3>
                <p>ليس لديك الصلاحية المطلوبة: {permissionsToCheck.join(', ')}</p>
            </div>
        );
    }

    return <>{children}</>;
};
