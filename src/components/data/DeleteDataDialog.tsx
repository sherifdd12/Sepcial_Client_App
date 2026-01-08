import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TABLE_CONFIGS, TableName } from '@/lib/importHelpers';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export function DeleteDataDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<TableName>('customers');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'selection' | 'date'>('all');

  // Fetch data for the selected table with date range filter
  const { data: tableData, isLoading } = useQuery({
    queryKey: ['delete-preview', selectedTable, dateRange, filterTab],
    queryFn: async () => {
      let query = supabase
        .from(selectedTable)
        .select('*')
        .order('created_at', { ascending: false });

      if (filterTab === 'date' && dateRange.from && dateRange.to) {
        query = query
          .gte('created_at', startOfDay(dateRange.from).toISOString())
          .lte('created_at', endOfDay(dateRange.to).toISOString());
      }

      query = query.limit(100);
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (filterTab === 'selection' && selectedRows.length === 0) {
        throw new Error('لم يتم اختيار أي صفوف للحذف');
      }

      let query = supabase.from(selectedTable).delete();

      // Always include a WHERE clause
      if (filterTab === 'selection') {
        query = query.in('id', selectedRows);
      } else if (filterTab === 'date' && dateRange.from && dateRange.to) {
        query = query
          .gte('created_at', startOfDay(dateRange.from).toISOString())
          .lte('created_at', endOfDay(dateRange.to).toISOString());
      } else {
        // For "all" case, use a filter that matches all rows
        query = query.not('id', 'is', null);
      }

      const { error } = await query;
      if (error) throw error;

      let message = '';
      if (filterTab === 'all') {
        message = `تم حذف جميع البيانات من ${TABLE_CONFIGS[selectedTable].name}`;
      } else if (filterTab === 'selection') {
        message = `تم حذف ${selectedRows.length} صف/صفوف من ${TABLE_CONFIGS[selectedTable].name}`;
      } else {
        message = `تم حذف البيانات من ${format(dateRange.from!, 'dd/MM/yyyy', { locale: ar })} إلى ${format(dateRange.to!, 'dd/MM/yyyy', { locale: ar })}`;
      }

      return { message };
    },
    onSuccess: (data) => {
      toast({ title: "نجاح", description: data.message });
      queryClient.invalidateQueries({ queryKey: [selectedTable] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setIsOpen(false);
      setSelectedRows([]);
      setDateRange({ from: undefined, to: undefined });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked && tableData) {
      setSelectedRows(tableData.map(row => row.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRows(prev => [...prev, id]);
    } else {
      setSelectedRows(prev => prev.filter(rowId => rowId !== id));
    }
  };

  const isDeleteDisabled = () => {
    if (filterTab === 'selection' && selectedRows.length === 0) return true;
    if (filterTab === 'date' && (!dateRange.from || !dateRange.to)) return true;
    return false;
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          حذف البيانات المستوردة
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>حذف البيانات المستوردة</AlertDialogTitle>
          <AlertDialogDescription>
            اختر الجدول وطريقة تحديد البيانات للحذف
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedTable} onValueChange={(value: TableName) => {
              setSelectedTable(value);
              setSelectedRows([]);
              setDateRange({ from: undefined, to: undefined });
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="اختر الجدول" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TABLE_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={filterTab} onValueChange={(value: any) => setFilterTab(value)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">حذف الكل</TabsTrigger>
              <TabsTrigger value="selection">تحديد صفوف</TabsTrigger>
              <TabsTrigger value="date">نطاق تاريخي</TabsTrigger>
            </TabsList>
            <TabsContent value="selection">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : tableData && tableData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={tableData.length > 0 && selectedRows.length === tableData.length}
                            onCheckedChange={(checked: boolean) => handleSelectAll(checked)}
                          />
                        </TableHead>
                        {TABLE_CONFIGS[selectedTable].fields.slice(0, 4).map(field => (
                          <TableHead key={field.value}>{field.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedRows.includes(row.id)}
                              onCheckedChange={(checked: boolean) => handleSelectRow(row.id, checked)}
                            />
                          </TableCell>
                          {TABLE_CONFIGS[selectedTable].fields.slice(0, 4).map(field => (
                            <TableCell key={field.value}>{String(row[field.value] || '')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد بيانات في هذا الجدول
                </div>
              )}
            </TabsContent>
            <TabsContent value="date" className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="grid gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[300px] justify-start text-right",
                          !dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd/MM/yyyy", { locale: ar })} -{" "}
                              {format(dateRange.to, "dd/MM/yyyy", { locale: ar })}
                            </>
                          ) : (
                            format(dateRange.from, "dd/MM/yyyy", { locale: ar })
                          )
                        ) : (
                          "اختر نطاق تاريخي"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        locale={ar}
                        selected={{
                          from: dateRange.from,
                          to: dateRange.to,
                        }}
                        onSelect={(range: any) => {
                          setDateRange({
                            from: range?.from,
                            to: range?.to,
                          });
                        }}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteMutation.isPending || isDeleteDisabled()}
            onClick={() => deleteMutation.mutate()}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                جاري الحذف...
              </>
            ) : filterTab === 'selection' ? (
              `حذف ${selectedRows.length} صف/صفوف`
            ) : filterTab === 'date' ? (
              'حذف البيانات في النطاق المحدد'
            ) : (
              `حذف جميع بيانات ${TABLE_CONFIGS[selectedTable].name}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
