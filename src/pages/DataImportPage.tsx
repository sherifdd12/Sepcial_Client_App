import { handleDatabaseError } from "@/lib/errorHandling";
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DeleteDataDialog } from "@/components/data/DeleteDataDialog";
import { FixImportErrorsDialog } from "@/components/data/FixImportErrorsDialog";
import { readExcelFile, importData, TABLE_CONFIGS, ImportConfig, importSingleRow } from '@/lib/importHelpers';
import { importTransactions, TRANSACTION_TABLE_CONFIG, importSingleTransactionRow } from '@/lib/transactionImport';
import { useAuth } from "@/hooks/useAuth";

type ImportError = {
  row: number;
  message: string;
  originalData: any;
};

const DataImportPage = () => {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);

  const [preview, setPreview] = useState<{ [sheet: string]: any[] }>({});
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<keyof typeof TABLE_CONFIGS>('customers');
  const [mapping, setMapping] = useState<{ [key: string]: string }>({});
  const [isFixDialogOpen, setIsFixDialogOpen] = useState(false);

  const handleRetryRow = async (rowData: any) => {
    try {
      if (selectedTable === 'transactions') {
        // Invert mappings for transaction import
        const invertedMappings: any = {};
        for (const [excelColumn, fieldName] of Object.entries(mapping)) {
          invertedMappings[fieldName] = excelColumn.trim();
        }
        await importSingleTransactionRow(rowData, invertedMappings);
      } else {
        const config: ImportConfig = {
          tableName: selectedTable,
          sheetName: selectedSheet,
          mappings: mapping
        };
        await importSingleRow(rowData, config);
      }

      // If successful, remove from errors
      setImportErrors(prev => prev.filter(e => e.originalData !== rowData));

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [selectedTable] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });

      return true;
    } catch (error: any) {
      throw error;
    }
  };

  const handleSkipRow = () => {
    if (importErrors.length > 0) {
      const errorToRemove = importErrors[0];
      setImportErrors(prev => prev.filter(e => e !== errorToRemove));
    }
  };

  const mutation = useMutation({
    mutationFn: async (config: ImportConfig) => {
      if (!file) throw new Error('No file selected');

      // For transactions, use the special import function
      if (config.tableName === 'transactions') {
        const { sheets, rows: allRows } = await new Promise<{ sheets: string[]; rows: any[] }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e: any) => {
            try {
              const XLSX = await import('xlsx');
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: 'array' });

              const sheet = workbook.Sheets[config.sheetName];
              const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

              // Clean up column headers - trim whitespace from keys
              const cleanedRows = rows.map((row: any) => {
                const cleanedRow: any = {};
                for (const [key, value] of Object.entries(row)) {
                  const cleanedKey = String(key).trim();
                  cleanedRow[cleanedKey] = value;
                }
                return cleanedRow;
              });

              resolve({ sheets: workbook.SheetNames, rows: cleanedRows });
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        // Invert the mappings for transaction import
        // DataImportPage mappings: { excelColumn: fieldName }
        // importTransactions expects: { fieldName: excelColumn }
        const invertedMappings: any = {};
        for (const [excelColumn, fieldName] of Object.entries(config.mappings)) {
          const cleanedExcelColumn = String(excelColumn).trim();
          invertedMappings[fieldName] = cleanedExcelColumn;
        }

        return importTransactions(allRows, invertedMappings as any);
      }

      // For other tables, use the regular import
      return importData(file, config);
    },
    onSuccess: (result: any) => {
      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
        const successCount = result.imported || 0;
        const errorCount = result.errors.length;
        toast({
          title: successCount > 0 ? "استيراد جزئي" : "فشل الاستيراد",
          description: successCount > 0
            ? `تم استيراد ${successCount} سجل بنجاح. ${errorCount} سجل فشل. يرجى تحميل التقرير لمعرفة التفاصيل.`
            : `تم العثور على ${errorCount} أخطاء. يرجى تحميل التقرير، تصحيح الأخطاء، ثم إعادة محاولة رفع الملف.`,
          variant: successCount > 0 ? "default" : "destructive",
        });
        if (successCount > 0) {
          queryClient.invalidateQueries({ queryKey: [selectedTable] });
          queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        }
      } else {
        toast({ title: "نجاح", description: result.message || "تم الاستيراد بنجاح" });
        queryClient.invalidateQueries({ queryKey: [selectedTable] });
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        resetForm();
      }
    },
    onError: (error: any) => {
      toast({ title: "خطأ فادح", description: error.message, variant: "destructive" });
      toast({ title: "خطأ فادح", description: handleDatabaseError(error), variant: "destructive" });
      setImportErrors([]);
    },
  });

  const resetForm = () => {
    setFile(null);
    setSheets([]);
    setPreview({});
    setSelectedSheet('');
    setMapping({});
    setImportErrors([]);
    // Reset the file input visually
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const downloadErrorCsv = () => {
    if (importErrors.length === 0 || !importErrors[0].originalData) return;

    // Get headers from the original data of the first error
    const originalHeaders = Object.keys(importErrors[0].originalData);
    const headers = [...originalHeaders, 'رسالة الخطأ'];

    const csvContent = [
      headers.join(','),
      ...importErrors.map(error => {
        const originalValues = originalHeaders.map(header => {
          const value = error.originalData[header];
          // Escape quotes and wrap in quotes if value contains a comma
          const stringValue = String(value ?? '').replace(/"/g, '""');
          return `"${stringValue}"`;
        });
        const errorMessage = `"${error.message.replace(/"/g, '""')}"`;
        return [...originalValues, errorMessage].join(',');
      })
    ].join('\n');

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM for Excel
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'import_errors.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      setFile(file);
      try {
        const { sheets, preview } = await readExcelFile(file);

        // Clean up column headers - trim whitespace
        const cleanedPreview: { [sheet: string]: any[] } = {};
        for (const [sheetName, rows] of Object.entries(preview)) {
          cleanedPreview[sheetName] = rows.map(row => {
            const cleanedRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              const cleanedKey = key.trim();
              cleanedRow[cleanedKey] = value;
            }
            return cleanedRow;
          });
        }

        setSheets(sheets);
        setPreview(cleanedPreview);
        if (sheets.length > 0) {
          setSelectedSheet(sheets[0]);
        }
      } catch (error: any) {
        toast({
          title: "Error reading file",
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const handleMappingChange = (header: string, value: string) => {
    setMapping(prev => ({ ...prev, [header]: value }));
  };

  const validateMapping = () => {
    const mappedFields = Object.values(mapping);
    const requiredFields = TABLE_CONFIGS[selectedTable].requiredFields;
    return requiredFields.every(field => mappedFields.includes(field));
  };

  const getMappedData = () => {
    if (!selectedSheet || !preview[selectedSheet]) return [];

    return preview[selectedSheet].map(row => {
      const newRow: { [key: string]: any } = {};
      for (const [sourceField, targetField] of Object.entries(mapping)) {
        if (row[sourceField] !== undefined) {
          newRow[targetField] = row[sourceField];
        }
      }
      return newRow;
    });
  };

  const handleImport = () => {
    const config: ImportConfig = {
      tableName: selectedTable,
      sheetName: selectedSheet,
      mappings: mapping
    };
    mutation.mutate(config);
  };

  const mappedData = getMappedData();
  const isMappingValid = validateMapping();
  const headers = selectedSheet && preview[selectedSheet]?.length > 0
    ? Object.keys(preview[selectedSheet][0])
    : [];

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">استيراد البيانات</h1>
        {hasRole('admin') && <DeleteDataDialog />}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>الخطوة 1: اختيار نوع البيانات والملف</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">نوع البيانات</label>
              <Select value={selectedTable} onValueChange={(value: keyof typeof TABLE_CONFIGS) => setSelectedTable(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="اختر نوع البيانات" />
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

            <div>
              <label className="text-sm font-medium mb-2 block">الملف (Excel أو CSV)</label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="max-w-xs"
                />
              </div>
            </div>

            {sheets.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">اختر ورقة العمل</label>
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="اختر ورقة العمل" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map(sheet => (
                      <SelectItem key={sheet} value={sheet}>
                        {sheet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>الخطوة 2: ربط الأعمدة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {headers.map(header => {
                // Get unique fields for this table, and filter out those already mapped
                const usedFields = Object.values(mapping).filter(v => v && v !== mapping[header]);
                const uniqueFields = TABLE_CONFIGS[selectedTable].fields.filter(
                  (field, idx, arr) =>
                    arr.findIndex(f => f.value === field.value) === idx &&
                    !usedFields.includes(field.value)
                );
                return (
                  <div key={header}>
                    <p className="text-sm font-medium mb-2">{header}</p>
                    <Select onValueChange={(value) => handleMappingChange(header, value)} value={mapping[header] || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الحقل" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueFields.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {importErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>تقرير الأخطاء</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>فشل عملية الاستيراد</AlertTitle>
              <AlertDescription>
                تم العثور على {importErrors.length} أخطاء في الملف. يرجى تحميل التقرير، تصحيح الأخطاء، ثم إعادة محاولة رفع الملف.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2 mb-4">
              <Button onClick={() => setIsFixDialogOpen(true)} variant="default">
                تصحيح الأخطاء ({importErrors.length})
              </Button>
              <Button onClick={downloadErrorCsv} variant="outline">
                تحميل تقرير الأخطاء (CSV)
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الصف في الملف</TableHead>
                    <TableHead>رسالة الخطأ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importErrors.slice(0, 10).map((error, i) => (
                    <TableRow key={i}>
                      <TableCell>{error.row}</TableCell>
                      <TableCell>{error.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(mapping).length > 0 && importErrors.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>الخطوة 3: معاينة البيانات والتحقق منها</CardTitle>
          </CardHeader>
          <CardContent>
            {isMappingValid ? (
              <>
                <p className='text-sm text-muted-foreground mb-4'>
                  معاينة أول 5 سجلات من البيانات المحددة
                </p>
                <div className="border rounded-lg overflow-hidden mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {TABLE_CONFIGS[selectedTable].fields
                          .filter(field => Object.values(mapping).includes(field.value))
                          .map(field => (
                            <TableHead key={field.value}>{field.label}</TableHead>
                          ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {TABLE_CONFIGS[selectedTable].fields
                            .filter(field => Object.values(mapping).includes(field.value))
                            .map(field => (
                              <TableCell key={field.value}>{String(row[field.value] ?? '')}</TableCell>
                            ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleImport}
                    disabled={mutation.isPending || mappedData.length === 0}
                  >
                    {mutation.isPending ? 'جاري الاستيراد...' : 'استيراد البيانات'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-destructive">
                يرجى ربط جميع الحقول المطلوبة ({TABLE_CONFIGS[selectedTable].requiredFields.map(f =>
                  TABLE_CONFIGS[selectedTable].fields.find(field => field.value === f)?.label
                ).join(', ')}) للمتابعة.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <FixImportErrorsDialog
        isOpen={isFixDialogOpen && importErrors.length > 0}
        onClose={() => setIsFixDialogOpen(false)}
        error={importErrors[0]}
        totalErrors={importErrors.length}
        onRetryRow={handleRetryRow}
        onSkipRow={handleSkipRow}
        tableName={selectedTable}
        mappings={mapping}
      />
    </div>
  );
};

export default DataImportPage;
