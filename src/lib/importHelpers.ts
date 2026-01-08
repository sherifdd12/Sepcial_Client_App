import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export type TableName = keyof typeof TABLE_CONFIGS;

export interface ImportConfig {
  tableName: TableName;
  sheetName: string;
  mappings: { [key: string]: string };
}

export const readExcelFile = (file: File): Promise<{
  sheets: string[];
  preview: { [sheet: string]: any[] };
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets = workbook.SheetNames;
        const preview: { [sheet: string]: any[] } = {};

        sheets.forEach(sheet => {
          const worksheet = workbook.Sheets[sheet];
          const rows = XLSX.utils.sheet_to_json(worksheet, {
            raw: false,
            defval: '',
            blankrows: false
          }).slice(0, 5); // Preview first 5 rows

          // Clean up column headers - trim whitespace
          preview[sheet] = rows.map((row: any) => {
            const cleanedRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              const cleanedKey = String(key).trim();
              cleanedRow[cleanedKey] = value;
            }
            return cleanedRow;
          });
        });

        resolve({ sheets, preview });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const getTableFields = async (tableName: string) => {
  const { data, error } = await supabase
    .from(tableName as any)
    .select()
    .limit(1);

  if (error) throw error;

  // Get column names from the first row
  return data.length > 0 ? Object.keys(data[0]) : [];
};

export const deleteImportedData = async (tableName: TableName, olderThanHours?: number) => {
  try {
    let query = supabase.from(tableName).delete();

    if (olderThanHours) {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);
      query = query.gte('created_at', cutoffTime.toISOString());
    } else {
      // For "all" case, use a filter that matches all rows
      query = query.not('id', 'is', null);
    }

    const { error } = await query;

    if (error) throw error;

    return {
      message: olderThanHours
        ? `تم حذف البيانات المستوردة في آخر ${olderThanHours} ساعة من ${TABLE_CONFIGS[tableName].name}`
        : `تم حذف جميع البيانات من ${TABLE_CONFIGS[tableName].name}`
    };
  } catch (error: any) {
    throw new Error(`فشل حذف البيانات: ${error.message}`);
  }
};

// Helper to fetch lookups for validation
export const fetchLookupMaps = async (tableName: string) => {
  const customerMap = new Map();
  const customerNameMap = new Map();
  const transactionMap = new Map();

  if (tableName === 'transactions' || tableName === 'payments') {
    const { data: customers } = await supabase.from('customers').select('id, sequence_number, full_name');
    if (customers) {
      customers.forEach(c => {
        if (c.sequence_number) {
          const seqNum = c.sequence_number.toString().trim();
          customerMap.set(seqNum, c.id);
          const numericSeq = parseInt(seqNum, 10).toString();
          if (numericSeq !== seqNum) {
            customerMap.set(numericSeq, c.id);
          }
        }
        if (c.full_name) {
          customerNameMap.set(c.full_name.trim(), c.id);
        }
      });
    }
  }

  if (tableName === 'payments') {
    const { data: transactions } = await supabase.from('transactions').select('id, sequence_number');
    if (transactions) {
      transactions.forEach(t => {
        if (t.sequence_number) {
          const seqNum = t.sequence_number.toString().trim();
          transactionMap.set(seqNum, t.id);
          const numericSeq = parseInt(seqNum, 10).toString();
          if (numericSeq !== seqNum) {
            transactionMap.set(numericSeq, t.id);
          }
        }
      });
    }
  }

  return { customerMap, customerNameMap, transactionMap };
};

// Validate and prepare a single row
export const validateAndPrepareRow = (
  row: any,
  config: ImportConfig,
  customerMap: Map<string, string>,
  customerNameMap: Map<string, string>,
  transactionMap: Map<string, string>
): { validRow: any | null; errors: string[] } => {
  const newRow: { [key: string]: any } = {};
  const rowErrors: string[] = [];

  for (const [sourceField, targetField] of Object.entries(config.mappings)) {
    const value = row[sourceField];

    // Basic validation for required fields
    if (TABLE_CONFIGS[config.tableName].requiredFields.includes(targetField) && (value === undefined || value === '' || value === null)) {
      rowErrors.push(`الحقل المطلوب '${sourceField}' فارغ`);
      continue;
    }

    // Handle empty values for optional fields
    if (value === undefined || value === '' || value === null) {
      if (['cost_price', 'extra_price', 'installment_amount', 'amount', 'number_of_installments'].includes(targetField)) {
        newRow[targetField] = 0;
      } else if (!TABLE_CONFIGS[config.tableName].requiredFields.includes(targetField)) {
        newRow[targetField] = '';
      }
      continue;
    }

    // Field-specific processing
    try {
      switch (targetField) {
        case 'sequence_number':
          newRow.sequence_number = value.toString().trim();
          break;
        case 'customer_sequence':
          const customerSeqValue = value.toString().trim();
          let customerId = customerMap.get(customerSeqValue);
          if (!customerId && !isNaN(Number(customerSeqValue))) {
            const numericValue = parseInt(customerSeqValue, 10).toString();
            customerId = customerMap.get(numericValue);
          }

          // Fallback to name matching if sequence fails
          if (!customerId && row['اسم العميل']) {
            customerId = customerNameMap.get(row['اسم العميل'].toString().trim());
          }
          if (!customerId && row['الاسم']) {
            customerId = customerNameMap.get(row['الاسم'].toString().trim());
          }

          if (!customerId) {
            rowErrors.push(`لم يتم العثور على عميل بالرقم أو الاسم '${value}'`);
          } else {
            newRow.customer_id = customerId;
          }
          break;
        case 'transaction_sequence':
          const transactionSeqValue = value.toString().trim();
          let transactionId = transactionMap.get(transactionSeqValue);
          if (!transactionId && !isNaN(Number(transactionSeqValue))) {
            const numericValue = parseInt(transactionSeqValue, 10).toString();
            transactionId = transactionMap.get(numericValue);
          }
          if (!transactionId) {
            rowErrors.push(`لم يتم العثور على معاملة بالرقم '${value}'`);
          } else {
            newRow.transaction_id = transactionId;
          }
          break;
        case 'cost_price':
        case 'extra_price':
        case 'installment_amount':
        case 'amount':
          const numValue = Number(value);
          if (isNaN(numValue)) {
            rowErrors.push(`القيمة '${value}' في '${sourceField}' ليست رقماً صالحاً`);
          } else {
            newRow[targetField] = numValue;
          }
          break;
        case 'number_of_installments':
          const intValue = Number(value);
          if (!Number.isInteger(intValue) || intValue < 1) {
            rowErrors.push(`القيمة '${value}' في '${sourceField}' يجب أن تكون رقماً صحيحاً أكبر من صفر`);
          } else {
            newRow[targetField] = intValue;
          }
          break;
        case 'start_date':
        case 'payment_date':
          try {
            const excelDate = Number(value);
            if (isNaN(excelDate)) {
              const parsedDate = new Date(value);
              if (isNaN(parsedDate.getTime())) {
                // Default to today if invalid
                newRow[targetField] = new Date().toISOString().split('T')[0];
              } else {
                newRow[targetField] = parsedDate.toISOString().split('T')[0];
              }
            } else {
              const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000) + 43200000);
              newRow[targetField] = jsDate.toISOString().split('T')[0];
            }
          } catch {
            newRow[targetField] = new Date().toISOString().split('T')[0];
          }
          break;
        case 'created_at':
          try {
            const excelDate = Number(value);
            if (isNaN(excelDate)) {
              const parsedDate = new Date(value);
              if (isNaN(parsedDate.getTime())) {
                // Fallback to start_date or today
                const fallbackDate = newRow.start_date || newRow.payment_date || new Date().toISOString();
                newRow[targetField] = new Date(fallbackDate).toISOString();
              } else {
                newRow[targetField] = parsedDate.toISOString();
              }
            } else {
              const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
              newRow[targetField] = jsDate.toISOString();
            }
          } catch {
            const fallbackDate = newRow.start_date || newRow.payment_date || new Date().toISOString();
            newRow[targetField] = new Date(fallbackDate).toISOString();
          }
          break;
        case 'legacy_image':
        case 'legacy_pdf':
          if (value) {
            if (!newRow._legacy) newRow._legacy = {};
            if (targetField === 'legacy_image') newRow._legacy.image = value.toString();
            if (targetField === 'legacy_pdf') newRow._legacy.pdf = value.toString();
          }
          break;
        default:
          newRow[targetField] = value.toString();
          break;
      }
    } catch (error: any) {
      rowErrors.push(`خطأ في معالجة '${sourceField}': ${error.message}`);
    }
  }

  if (rowErrors.length > 0) {
    return { validRow: null, errors: rowErrors };
  }

  // Add default values and derived fields
  if (config.tableName === 'transactions') {
    // Respect imported amount if provided, otherwise calculate it
    if (!newRow.amount || newRow.amount === 0) {
      newRow.amount = (newRow.cost_price || 0) + (newRow.extra_price || 0);
    }
    newRow.remaining_balance = newRow.amount;
    newRow.status = 'active';
    // Ensure created_at is set if missing
    if (!newRow.created_at) {
      const fallbackDate = newRow.start_date || new Date().toISOString();
      newRow.created_at = new Date(fallbackDate).toISOString();
    }
    delete newRow.profit;
  }

  return { validRow: newRow, errors: [] };
};

// Import a single row (for interactive retry)
export const importSingleRow = async (row: any, config: ImportConfig) => {
  const { customerMap, customerNameMap, transactionMap } = await fetchLookupMaps(config.tableName);
  const { validRow, errors } = validateAndPrepareRow(row, config, customerMap, customerNameMap, transactionMap);

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  if (!validRow) throw new Error("Unknown error: Row is null");

  if (config.tableName === 'payments') {
    const legacyData = validRow._legacy;
    delete validRow._legacy;

    const { error: rpcError } = await supabase.rpc('record_payment', {
      p_transaction_id: validRow.transaction_id,
      p_amount: validRow.amount,
      p_payment_date: validRow.payment_date,
      p_notes: validRow.notes || null
    });

    if (rpcError) throw new Error(rpcError.message);

    // Handle legacy attachments
    if (legacyData && (legacyData.image || legacyData.pdf)) {
      const { data: payData } = await supabase.from('payments')
        .select('id')
        .eq('transaction_id', validRow.transaction_id)
        .eq('amount', validRow.amount)
        .eq('payment_date', validRow.payment_date)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (payData) {
        const attachments = [];
        if (legacyData.image) attachments.push({ payment_id: payData.id, file_path: legacyData.image, file_url: legacyData.image, file_name: 'Legacy Image', file_type: 'image', created_at: new Date().toISOString() });
        if (legacyData.pdf) attachments.push({ payment_id: payData.id, file_path: legacyData.pdf, file_url: legacyData.pdf, file_name: 'Legacy PDF', file_type: 'application/pdf', created_at: new Date().toISOString() });
        if (attachments.length > 0) await supabase.from('document_attachments').insert(attachments);
      }
    }
  } else {
    const { _legacy, ...rest } = validRow;
    const { data: insertedData, error } = await supabase.from(config.tableName).insert([rest]).select().single();

    if (error) throw error;

    if (insertedData && config.tableName === 'transactions' && _legacy) {
      const attachments = [];
      if (_legacy.image) attachments.push({ transaction_id: insertedData.id, file_path: _legacy.image, file_url: _legacy.image, file_name: 'Legacy Image', file_type: 'image', created_at: new Date().toISOString() });
      if (_legacy.pdf) attachments.push({ transaction_id: insertedData.id, file_path: _legacy.pdf, file_url: _legacy.pdf, file_name: 'Legacy PDF', file_type: 'application/pdf', created_at: new Date().toISOString() });
      if (attachments.length > 0) await supabase.from('document_attachments').insert(attachments);
    }
  }

  return true;
};

// A more robust and generic data import function
export const importData = async (file: File, config: ImportConfig) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[config.sheetName];
        const rawJsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          defval: "",
          blankrows: false,
        });

        // Clean up column headers
        const jsonData = rawJsonData.map((row: any) => {
          const cleanedRow: any = {};
          for (const [key, value] of Object.entries(row)) {
            cleanedRow[String(key).trim()] = value;
          }
          return cleanedRow;
        });

        const validRows: any[] = [];
        const errors: { row: number; message: string, originalData: any }[] = [];

        // Pre-fetch data for lookups
        const { customerMap, customerNameMap, transactionMap } = await fetchLookupMaps(config.tableName);

        for (const [index, row] of jsonData.entries()) {
          const { validRow, errors: rowErrors } = validateAndPrepareRow(row, config, customerMap, customerNameMap, transactionMap);

          if (rowErrors.length > 0) {
            errors.push({ row: index + 2, message: rowErrors.join('; '), originalData: row });
          } else if (validRow) {
            validRows.push(validRow);
          }
        }

        // Batch insert valid rows
        if (validRows.length > 0) {
          if (config.tableName === 'payments') {
            // Payments must be inserted one by one due to RPC
            for (let i = 0; i < validRows.length; i++) {
              const payment = validRows[i];
              const legacyData = payment._legacy;
              delete payment._legacy;

              const { error: rpcError } = await supabase.rpc('record_payment', {
                p_transaction_id: payment.transaction_id,
                p_amount: payment.amount,
                p_payment_date: payment.payment_date,
                p_notes: payment.notes || null
              });

              if (rpcError) {
                errors.push({ row: i + 2, message: `خطأ في تسجيل دفعة: ${rpcError.message}`, originalData: payment });
              } else {
                // Handle legacy attachments for payments
                if (legacyData && (legacyData.image || legacyData.pdf)) {
                  const { data: payData } = await supabase.from('payments')
                    .select('id')
                    .eq('transaction_id', payment.transaction_id)
                    .eq('amount', payment.amount)
                    .eq('payment_date', payment.payment_date)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                  if (payData) {
                    const attachments = [];
                    if (legacyData.image) attachments.push({ payment_id: payData.id, file_path: legacyData.image, file_url: legacyData.image, file_name: 'Legacy Image', file_type: 'image', created_at: new Date().toISOString() });
                    if (legacyData.pdf) attachments.push({ payment_id: payData.id, file_path: legacyData.pdf, file_url: legacyData.pdf, file_name: 'Legacy PDF', file_type: 'application/pdf', created_at: new Date().toISOString() });
                    if (attachments.length > 0) await supabase.from('document_attachments').insert(attachments);
                  }
                }
              }
            }
          } else {
            // Batch insert for other tables
            const rowsToInsert = validRows.map(row => {
              const { _legacy, ...rest } = row;
              return rest;
            });

            const { data: insertedData, error: insertError } = await supabase
              .from(config.tableName)
              .insert(rowsToInsert)
              .select();

            if (insertError) {
              return reject(new Error(`Database error during insert: ${insertError.message}`));
            }

            // Handle legacy attachments for transactions
            if (insertedData && config.tableName === 'transactions') {
              const attachmentsToInsert: any[] = [];
              const legacyMap = new Map();
              validRows.forEach(row => {
                if (row.sequence_number && row._legacy) {
                  legacyMap.set(row.sequence_number.toString(), row._legacy);
                }
              });

              insertedData.forEach((row: any) => {
                if (row.sequence_number) {
                  const legacyData = legacyMap.get(row.sequence_number.toString());
                  if (legacyData) {
                    if (legacyData.image) attachmentsToInsert.push({ transaction_id: row.id, file_path: legacyData.image, file_url: legacyData.image, file_name: 'Legacy Image', file_type: 'image', created_at: new Date().toISOString() });
                    if (legacyData.pdf) attachmentsToInsert.push({ transaction_id: row.id, file_path: legacyData.pdf, file_url: legacyData.pdf, file_name: 'Legacy PDF', file_type: 'application/pdf', created_at: new Date().toISOString() });
                  }
                }
              });

              if (attachmentsToInsert.length > 0) {
                await supabase.from('document_attachments').insert(attachmentsToInsert);
              }
            }
          }
        }

        resolve({
          imported: validRows.length,
          errors: errors,
          message: `Import complete. Successfully imported ${validRows.length} rows. Skipped ${errors.length} rows with errors.`
        });

        await supabase.rpc('check_overdue_transactions');

      } catch (error: any) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const TABLE_CONFIGS = {
  customers: {
    name: 'العملاء',
    requiredFields: ['full_name'],
    fields: [
      { value: 'sequence_number', label: 'كود' },
      { value: 'sequence_number', label: 'كود العميل' },
      { value: 'full_name', label: 'أسماء العملاء' },
      { value: 'full_name', label: 'الاسم' },
      { value: 'full_name', label: 'اسم العميل' },
      { value: 'mobile_number', label: 'Mobile' },
      { value: 'mobile_number', label: 'رقم الهاتف' },
      { value: 'alternate_phone', label: 'Mobile2' },
      { value: 'alternate_phone', label: 'رقم هاتف بديل' },
      { value: 'civil_id', label: 'الرقم المدني' }
    ]
  },
  transactions: {
    name: 'المعاملات',
    requiredFields: ['customer_sequence'],
    fields: [
      { value: 'sequence_number', label: 'رقم البيع' },
      { value: 'sequence_number', label: 'كود' },
      { value: 'customer_sequence', label: 'كود العميل' },
      { value: 'customer_sequence', label: 'رقم العميل' },
      { value: 'customer_sequence', label: 'كود' },
      { value: 'cost_price', label: 'سعر السلعة' },
      { value: 'extra_price', label: 'السعر الاضافى' },
      { value: 'amount', label: 'إجمالي السعر' },
      { value: 'installment_amount', label: 'قيمة القسط' },
      { value: 'installment_amount', label: 'القسط الشهرى' },
      { value: 'number_of_installments', label: 'عدد الدفعات' },
      { value: 'start_date', label: 'تاريخ البدء' },
      { value: 'start_date', label: 'تاريخ بدء القرض' },
      { value: 'notes', label: 'ملاحظات' },
      { value: 'status', label: 'الحالة', defaultValue: 'active' },
      { value: 'has_legal_case', label: 'قضية قانونية', defaultValue: false },
      { value: 'created_at', label: 'تاريخ الإنشاء' },
      { value: 'created_at', label: 'Created' },
      { value: 'legacy_image', label: 'رابط الصورة (قديم)' },
      { value: 'legacy_pdf', label: 'رابط PDF (قديم)' }
    ]
  },
  payments: {
    name: 'المدفوعات',
    requiredFields: ['transaction_sequence', 'customer_sequence', 'amount', 'payment_date'],
    fields: [
      { value: 'transaction_sequence', label: 'رقم البيع' },
      { value: 'transaction_sequence', label: 'رقم المعاملة' },
      { value: 'customer_sequence', label: 'كود العميل' },
      { value: 'customer_sequence', label: 'رقم العميل' },
      { value: 'customer_sequence', label: 'كود' },
      { value: 'amount', label: 'المبلغ' },
      { value: 'amount', label: 'قيمة الدفعة' },
      { value: 'payment_date', label: 'تاريخ الدفع' },
      { value: 'payment_date', label: 'تاريخ الدفعة' },
      { value: 'notes', label: 'ملاحظات' },
      { value: 'status', label: 'الحالة' },
      { value: 'created_at', label: 'تاريخ الإنشاء' },
      { value: 'legacy_image', label: 'رابط الصورة (قديم)' },
      { value: 'legacy_pdf', label: 'رابط PDF (قديم)' },
      { value: 'legacy_image', label: 'image' },
      { value: 'legacy_pdf', label: 'pdf' }
    ]
  },

};
