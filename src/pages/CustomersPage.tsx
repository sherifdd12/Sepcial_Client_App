import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CustomerList from "@/components/customers/CustomerList";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerDetailDialog from "@/components/customers/CustomerDetailDialog";
import { CustomerExportTemplate } from "@/components/customers/CustomerExportTemplate";
import { Customer } from "@/lib/types";
import { useSafeToast } from "@/hooks/useSafeToast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

// --- Supabase API Functions ---
const getCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase.from('customers').select('*');
  if (error) throw new Error(error.message);

  // Sort by sequence_number as integer in descending order (newest first)
  return (data as Customer[]).sort((a, b) => {
    const numA = parseInt(a.sequence_number || '0');
    const numB = parseInt(b.sequence_number || '0');
    return numB - numA;
  });
};

const getDetailedCustomers = async (customerIds: string[]): Promise<any[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select(`
      *,
      transactions (
        *,
        payments (*)
      )
    `)
    .in('id', customerIds);

  if (error) throw new Error(error.message);
  return data;
};

const addCustomer = async (customer: Omit<Customer, 'id' | 'created_at' | 'updatedAt'>): Promise<any> => {
  const { data, error } = await supabase.from('customers').insert([customer]).select();
  if (error) throw new Error(error.message);
  return data;
};

const updateCustomer = async (customer: Partial<Customer>): Promise<any> => {
  const { id, attachments, ...updateData } = customer;
  // Remove attachments from updateData, only update customer fields
  const { data, error } = await supabase.from('customers').update(updateData).eq('id', id);
  if (error) throw new Error(error.message);
  return data;
};

const deleteCustomer = async (customerId: string): Promise<any> => {
  const { data, error } = await supabase.from('customers').delete().eq('id', customerId);
  if (error) throw new Error(error.message);
  return data;
};

const deleteMultipleCustomers = async (customerIds: string[]): Promise<any> => {
  const { error } = await supabase.rpc('delete_multiple_customers', { customer_ids: customerIds });
  if (error) throw new Error(error.message);
  return;
};
// --- End Supabase API Functions ---

const CustomersPage = () => {
  const queryClient = useQueryClient();
  const toast = useSafeToast();
  const [searchParams] = useSearchParams();
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>();
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [detailedCustomersForExport, setDetailedCustomersForExport] = useState<any[]>([]);
  const [exportType, setExportType] = useState<'single' | 'summary'>('summary');
  const { hasPermission } = usePermissions();

  const { data: customers, isLoading, isError } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: getCustomers,
  });

  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (customerId && customers) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setViewingCustomer(customer);
      }
    }
  }, [searchParams, customers]);

  const addMutation = useMutation({
    mutationFn: addCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setShowCustomerForm(false);
      toast.success("تم إضافة العميل بنجاح");
    },
    onError: (error: any) => {
      toast.error(error, "فشل إضافة العميل");
    }
  });

  const updateMutation = useMutation({
    mutationFn: updateCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setShowCustomerForm(false);
      setEditingCustomer(undefined);
      toast.success("تم تحديث العميل بنجاح");
    },
    onError: (error: any) => {
      toast.error(error, "فشل تحديث العميل");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("تم حذف العميل بنجاح");
    },
    onError: (error: any) => {
      toast.error(error, "فشل حذف العميل");
    }
  });

  const deleteMultipleMutation = useMutation({
    mutationFn: deleteMultipleCustomers,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", "transactions", "payments", "dashboardStats"] });
      toast.success("تم حذف العملاء المحددين بنجاح");
    },
    onError: (error: any) => {
      toast.error(error, "فشل حذف العملاء");
    }
  });

  const handleSaveCustomer = (customerData: Omit<Customer, 'id' | 'created_at' | 'updatedAt'>) => {
    if (editingCustomer) {
      updateMutation.mutate({ ...customerData, id: editingCustomer.id });
    } else {
      addMutation.mutate(customerData);
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowCustomerForm(true);
  };

  const handleAddCustomer = () => {
    setEditingCustomer(undefined);
    setShowCustomerForm(true);
  };

  const handleViewCustomer = (customer: Customer) => {
    setViewingCustomer(customer);
  };

  const exportToExcel = async (selectedIds: string[] = []) => {
    if (!customers) return;
    setIsExporting(true);
    toast.info("جاري تجهيز ملف Excel...");

    try {
      const idsToExport = selectedIds.length > 0 ? selectedIds : customers.map(c => c.id);
      const detailedData = await getDetailedCustomers(idsToExport);

      const workbook = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = detailedData.map(c => {
        const totalAmount = c.transactions.reduce((sum: number, t: any) => sum + t.amount, 0);
        const totalPaid = c.transactions.reduce((sum: number, t: any) => sum + (t.amount - t.remaining_balance), 0);
        const totalRemaining = c.transactions.reduce((sum: number, t: any) => sum + t.remaining_balance, 0);

        return {
          "م العميل": c.sequence_number,
          "الاسم الكامل": c.full_name,
          "رقم الهاتف": c.mobile_number,
          "عدد المعاملات": c.transactions.length,
          "إجمالي المديونية": totalAmount,
          "إجمالي المدفوع": totalPaid,
          "المبلغ المتبقي": totalRemaining,
          "تاريخ التسجيل": new Date(c.created_at).toLocaleDateString('ar-KW')
        };
      });
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "ملخص العملاء");

      // Detailed Sheet (All Transactions)
      const transactionsData = detailedData.flatMap(c =>
        c.transactions.map((t: any) => ({
          "اسم العميل": c.full_name,
          "رقم المعاملة": t.sequence_number,
          "تاريخ البدء": new Date(t.start_date).toLocaleDateString('ar-KW'),
          "المبلغ": t.amount,
          "المتبقي": t.remaining_balance,
          "الحالة": t.status
        }))
      );
      const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, "تفاصيل المعاملات");

      // Set RTL
      if (!workbook.Workbook) workbook.Workbook = {};
      if (!workbook.Workbook.Views) workbook.Workbook.Views = [];
      workbook.Workbook.Views[0] = { RTL: true };

      XLSX.writeFile(workbook, `customers_report_${new Date().toLocaleDateString()}.xlsx`);
      toast.success("تم تصدير ملف Excel بنجاح");
    } catch (error) {
      console.error("Excel Export Error:", error);
      toast.error("خطأ في تصدير Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async (selectedIds: string[] = []) => {
    if (!customers) return;

    setIsExporting(true);
    toast.info("جاري تجهيز ملف PDF...");

    try {
      const idsToExport = selectedIds.length > 0 ? selectedIds : customers.map(c => c.id);
      const detailedData = await getDetailedCustomers(idsToExport);

      setDetailedCustomersForExport(detailedData);
      setExportType(idsToExport.length === 1 ? 'single' : 'summary');

      // Wait for render
      setTimeout(async () => {
        const element = exportRef.current;
        if (!element) return;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff"
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(`customers_report_${new Date().toLocaleDateString()}.pdf`);
        toast.success("تم تصدير ملف PDF بنجاح");

        // Reset state
        setDetailedCustomersForExport([]);
      }, 1000); // Increased timeout to ensure render
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("خطأ في تصدير PDF");
      setIsExporting(false);
      setDetailedCustomersForExport([]);
    }
  };

  if (isLoading) return <div>جاري تحميل العملاء...</div>;
  if (isError) return <div>خطأ في تحميل العملاء</div>;

  if (showCustomerForm) {
    return (
      <CustomerForm
        customer={editingCustomer}
        onSave={handleSaveCustomer}
        onCancel={() => {
          setShowCustomerForm(false);
          setEditingCustomer(undefined);
        }}
        isLoading={addMutation.isPending || updateMutation.isPending}
        suggestedSequenceNumber={
          editingCustomer
            ? undefined
            : (Math.max(0, ...((customers || []).map(c => {
              const num = parseInt(c.sequence_number);
              return isNaN(num) ? 0 : num;
            }))) + 1).toString()
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex gap-2 justify-end">
        {hasPermission('can_export_data') && (
          <>
            <Button variant="outline" onClick={() => exportToExcel()} className="gap-2">
              <FileSpreadsheet size={16} />
              تصدير Excel
            </Button>
            <Button variant="outline" onClick={() => exportToPDF()} className="gap-2" disabled={isExporting}>
              {isExporting ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
              تصدير PDF
            </Button>
          </>
        )}
      </div>

      <CustomerList
        customers={customers || []}
        onAddCustomer={handleAddCustomer}
        onEditCustomer={handleEditCustomer}
        onViewCustomer={handleViewCustomer}
        onDeleteCustomer={(id) => deleteMutation.mutate(id)}
        onDeleteMultipleCustomers={(ids) => deleteMultipleMutation.mutate(ids)}
        onExportExcel={exportToExcel}
        onExportPDF={exportToPDF}
      />
      <CustomerDetailDialog
        customer={viewingCustomer}
        open={!!viewingCustomer}
        onOpenChange={(open) => !open && setViewingCustomer(null)}
      />

      {/* Hidden Template for PDF Export */}
      <div className="fixed -left-[9999px] top-0">
        <div ref={exportRef}>
          <CustomerExportTemplate
            customers={detailedCustomersForExport}
            type={exportType}
          />
        </div>
      </div>
    </>
  );
};

export default CustomersPage;