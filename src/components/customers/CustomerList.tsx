import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Customer } from "@/lib/types";
import { formatArabicDate } from "@/lib/utils-arabic";
import { Search, Edit, Eye, UserPlus, Trash2, MessageCircle, FileSpreadsheet, FileText, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/usePermissions";

interface CustomerListProps {
  customers: Customer[];
  onAddCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
  onViewCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onDeleteMultipleCustomers: (customerIds: string[]) => void;
  onExportExcel?: (selectedIds: string[]) => void;
  onExportPDF?: (selectedIds: string[]) => void;
}

const CustomerList = ({
  customers,
  onAddCustomer,
  onEditCustomer,
  onViewCustomer,
  onDeleteCustomer,
  onDeleteMultipleCustomers,
  onExportExcel,
  onExportPDF,
}: CustomerListProps) => {
  const { hasRole, isReadOnly } = useAuth();
  const { hasPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mobile_number.includes(searchTerm) ||
      (customer.civil_id && customer.civil_id.includes(searchTerm))
  );

  const handleSelect = (customerId: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(filteredCustomers.map((c) => c.id));
    } else {
      setSelectedCustomers([]);
    }
  };

  const isAllSelected =
    filteredCustomers.length > 0 &&
    selectedCustomers.length === filteredCustomers.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            إدارة العملاء
          </h2>
          <p className="text-muted-foreground">
            إضافة وإدارة بيانات العملاء
          </p>
        </div>
        <div className="flex items-center space-x-reverse space-x-2">
          {selectedCustomers.length > 0 && (
            <>
              {hasRole("admin") && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="flex items-center space-x-reverse space-x-2"
                      disabled={isReadOnly}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>حذف المحدد ({selectedCustomers.length})</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف العملاء المحددين ({selectedCustomers.length}) وجميع المعاملات والمدفوعات المرتبطة بهم نهائياً. لا يمكن التراجع عن هذا الإجراء.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          onDeleteMultipleCustomers(selectedCustomers);
                          setSelectedCustomers([]);
                        }}
                      >
                        حذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {hasPermission('can_export_data') && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-reverse space-x-2"
                    onClick={() => onExportExcel?.(selectedCustomers)}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Excel ({selectedCustomers.length})</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-reverse space-x-2"
                    onClick={() => onExportPDF?.(selectedCustomers)}
                  >
                    <FileText className="h-4 w-4" />
                    <span>PDF ({selectedCustomers.length})</span>
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            onClick={onAddCustomer}
            className="flex items-center space-x-reverse space-x-2"
            disabled={isReadOnly}
          >
            <UserPlus className="h-4 w-4" />
            <span>إضافة عميل جديد</span>
          </Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>قائمة العملاء</CardTitle>
          <div className="flex items-center space-x-reverse space-x-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث بالاسم أو الهاتف أو الرقم المدني..."
                value={searchTerm}
                aria-label="Select all"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="text-right">م العميل</TableHead>
                  <TableHead className="text-right">الاسم الكامل</TableHead>
                  <TableHead className="text-right">رقم الهاتف</TableHead>
                  <TableHead className="text-right">رقم الهاتف2</TableHead>
                  <TableHead className="text-right">الرقم المدني</TableHead>
                  <TableHead className="text-right">تاريخ التسجيل</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      لا توجد عملاء مطابقون للبحث
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow key={customer.id} data-state={selectedCustomers.includes(customer.id) && "selected"}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCustomers.includes(customer.id)}
                          onCheckedChange={() => handleSelect(customer.id)}
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Badge variant="outline">{customer.sequence_number}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {customer.full_name}
                      </TableCell>
                      <TableCell>{customer.mobile_number}</TableCell>
                      <TableCell>{customer.alternate_phone || "-"}</TableCell>
                      <TableCell>{customer.civil_id || "-"}</TableCell>
                      <TableCell>{formatArabicDate(new Date(customer.created_at))}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-reverse space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewCustomer(customer)}
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => window.open(`https://wa.me/${customer.mobile_number.replace(/\s+/g, '')}`, '_blank')}
                            title="تواصل عبر واتساب"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {hasRole("admin") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditCustomer(customer)}
                              title="تعديل"
                              disabled={isReadOnly}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasRole("admin") && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" title="حذف" disabled={isReadOnly}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    سيتم حذف العميل "{customer.full_name}" نهائياً. لا يمكن التراجع عن هذا الإجراء.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDeleteCustomer(customer.id)}>
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed">
                <p className="text-gray-500">لا توجد عملاء مطابقون للبحث</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div key={customer.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs font-mono">{customer.sequence_number}</Badge>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">{customer.full_name}</h3>
                      </div>
                      <Checkbox
                        checked={selectedCustomers.includes(customer.id)}
                        onCheckedChange={() => handleSelect(customer.id)}
                        className="mt-1"
                      />
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-gray-50">
                        <span className="text-gray-500">رقم الهاتف</span>
                        <span className="font-medium dir-ltr">{customer.mobile_number}</span>
                      </div>
                      {customer.civil_id && (
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-gray-500">الرقم المدني</span>
                          <span className="font-medium">{customer.civil_id}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1">
                        <span className="text-gray-500">تاريخ التسجيل</span>
                        <span className="font-medium">{formatArabicDate(new Date(customer.created_at))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-4 py-3 border-t flex justify-between items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-10 text-sm" onClick={() => onViewCustomer(customer)}>
                      <Eye className="h-4 w-4 ml-2" />
                      التفاصيل
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 h-10 text-sm bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => window.open(`https://wa.me/${customer.mobile_number.replace(/\s+/g, '')}`, '_blank')}
                    >
                      <MessageCircle className="h-4 w-4 ml-2" />
                      واتساب
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10">
                          <MoreHorizontal className="h-5 w-5 text-gray-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {hasRole("admin") && (
                          <>
                            <DropdownMenuItem onClick={() => onEditCustomer(customer)} disabled={isReadOnly}>
                              <Edit className="h-4 w-4 ml-2" />
                              <span>تعديل</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => onDeleteCustomer(customer.id)}
                              disabled={isReadOnly}
                            >
                              <Trash2 className="h-4 w-4 ml-2" />
                              <span>حذف</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerList;