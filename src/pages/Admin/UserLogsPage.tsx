import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Search, Filter, Clock, User, Database, LogIn, Plus, Edit, Trash2 } from 'lucide-react';
import { formatArabicDate } from '@/lib/utils-arabic';
import DateFilter from '@/components/shared/DateFilter';

interface UserLog {
    id: string;
    user_id: string;
    action_type: 'login' | 'insert' | 'update' | 'delete';
    table_name: string;
    record_id: string;
    old_data: any;
    new_data: any;
    ip_address: string;
    user_agent: string;
    created_at: string;
    user_email?: string;
}

const fetchUserLogs = async (): Promise<UserLog[]> => {
    const { data, error } = await supabase
        .from('user_logs')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data as any || [];
};

const UserLogsPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<{ year: number | null; month: number | null }>({ year: null, month: null });
    const [userEmails, setUserEmails] = useState<{ [key: string]: string }>({});

    const { data: logs = [], isLoading, error } = useQuery({
        queryKey: ['user-logs'],
        queryFn: fetchUserLogs,
    });

    useEffect(() => {
        const fetchUserEmails = async () => {
            try {
                const { data: profiles, error: profilesError } = await (supabase as any)
                    .from('profiles')
                    .select('id, email');

                if (!profilesError && profiles) {
                    const emailMap: { [key: string]: string } = {};
                    profiles.forEach((profile: any) => {
                        emailMap[profile.id] = profile.email || 'Unknown';
                    });
                    setUserEmails(emailMap);
                }
            } catch (err) {
                console.log('Could not fetch user emails', err);
            }
        };

        if (logs.length > 0) {
            fetchUserEmails();
        }
    }, [logs]);

    const filteredLogs = logs.filter(log => {
        const userEmail = userEmails[log.user_id] || log.user_id || '';
        const matchesSearch = userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.table_name || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;

        let matchesDate = true;
        if (dateFilter.year || dateFilter.month) {
            const logDate = new Date(log.created_at);
            const matchesYear = dateFilter.year ? logDate.getFullYear() === dateFilter.year : true;
            const matchesMonth = dateFilter.month ? logDate.getMonth() + 1 === dateFilter.month : true;
            matchesDate = matchesYear && matchesMonth;
        }

        return matchesSearch && matchesAction && matchesDate;
    });

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'login':
                return <Badge className="bg-blue-500"><LogIn className="h-3 w-3 mr-1" />دخول</Badge>;
            case 'insert':
                return <Badge className="bg-green-500"><Plus className="h-3 w-3 mr-1" />إضافة</Badge>;
            case 'update':
                return <Badge className="bg-amber-500"><Edit className="h-3 w-3 mr-1" />تعديل</Badge>;
            case 'delete':
                return <Badge className="bg-red-500"><Trash2 className="h-3 w-3 mr-1" />حذف</Badge>;
            default:
                return <Badge>{action}</Badge>;
        }
    };

    if (isLoading) return <div className="p-6 text-center">جاري تحميل السجلات...</div>;
    if (error) return <div className="p-6 text-center text-destructive">خطأ: {error.message}</div>;

    return (
        <div className="space-y-6 p-6" dir="rtl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Shield className="h-8 w-8" />
                    سجلات النشاط
                </h1>
                <p className="text-muted-foreground mt-2">
                    مراقبة نشاط المستخدمين وتعديلات البيانات في النظام
                </p>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="relative w-full md:max-w-sm">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="البحث بالمستخدم أو الجدول..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pr-10 text-right"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Select value={actionFilter} onValueChange={setActionFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <Filter className="h-4 w-4 ml-2" />
                                    <SelectValue placeholder="نوع النشاط" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الأنشطة</SelectItem>
                                    <SelectItem value="login">دخول</SelectItem>
                                    <SelectItem value="insert">إضافة</SelectItem>
                                    <SelectItem value="update">تعديل</SelectItem>
                                    <SelectItem value="delete">حذف</SelectItem>
                                </SelectContent>
                            </Select>
                            <DateFilter onFilterChange={setDateFilter} />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">المستخدم</TableHead>
                                    <TableHead className="text-right">النشاط</TableHead>
                                    <TableHead className="text-right">الجدول</TableHead>
                                    <TableHead className="text-right">التاريخ والوقت</TableHead>
                                    <TableHead className="text-right">تفاصيل</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            لا توجد سجلات مطابقة للبحث
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    {userEmails[log.user_id] || 'نظام / غير معروف'}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getActionBadge(log.action_type)}</TableCell>
                                            <TableCell>
                                                {log.table_name ? (
                                                    <div className="flex items-center gap-1">
                                                        <Database className="h-3 w-3 text-muted-foreground" />
                                                        <span className="text-sm">{log.table_name}</span>
                                                    </div>
                                                ) : '---'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    {formatArabicDate(new Date(log.created_at))} {new Date(log.created_at).toLocaleTimeString('ar-EG')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {log.action_type !== 'login' && (
                                                    <Badge variant="outline" className="cursor-help" title={JSON.stringify(log.new_data || log.old_data, null, 2)}>
                                                        عرض البيانات
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default UserLogsPage;
