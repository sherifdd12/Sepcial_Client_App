import { useAuth } from '@/hooks/useAuth';
import { Navigate, Outlet } from 'react-router-dom';

const AdminLayout = () => {
  const { hasRole, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!hasRole('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminLayout;
