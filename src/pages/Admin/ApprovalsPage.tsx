import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  role: string;
}

const ApprovalsPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    // Disabled - this RPC function doesn't exist
    // const { data, error } = await supabase.rpc('get_pending_users');
    const { data, error } = await supabase.from('user_roles').select('*');

    if (error) {
      toast.error('Failed to fetch users');
      console.error(error);
      setUsers([]);
    } else if (data) {
      setUsers(data as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const approveUser = async (userId: string) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role: 'staff' as any })
      .eq('user_id', userId);

    if (error) {
      toast.error('Failed to approve user');
    } else {
      toast.success('User approved successfully');
      fetchUsers();
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>User Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p>No pending users to approve.</p>
          ) : (
            <ul>
              {users.map(user => (
                <li key={user.id} className="flex items-center justify-between p-2 border-b">
                  <span>{user.email}</span>
                  <Button onClick={() => approveUser(user.id)}>Approve</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalsPage;
