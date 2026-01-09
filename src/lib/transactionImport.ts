import { supabase } from '@/integrations/supabase/client';
import { Transaction, Customer } from './types';

interface TransactionImportRow {
  [key: string]: string | number;
}

interface CustomerValidationResult {
  id: string;
  sequence_number: string;
}

export const validateAndMapCustomers = async (
  rows: TransactionImportRow[],
  customerSequenceField: string
): Promise<{ errorRows: { row: number; message: string; originalData: any }[]; validatedRows: (Omit<TransactionImportRow, 'validated_customer'> & { validated_customer: CustomerValidationResult })[] }> => {
  // Get all customers
  const { data: customers } = await supabase
    .from("customers")
    .select("id, sequence_number, full_name")
    .order("created_at");

  if (!customers) {
    throw new Error("فشل في جلب بيانات العملاء");
  }

  const customerMap = new Map();
  const customerNameMap = new Map();

  customers.forEach(c => {
    if (c.sequence_number) {
      const seqNum = c.sequence_number.toString().trim();
      customerMap.set(seqNum, { id: c.id, sequence_number: c.sequence_number });
      const numericSeq = parseInt(seqNum, 10).toString();
      if (numericSeq !== seqNum) {
        customerMap.set(numericSeq, { id: c.id, sequence_number: c.sequence_number });
      }
    }
    if (c.full_name) {
      customerNameMap.set(c.full_name.trim(), { id: c.id, sequence_number: c.sequence_number || '' });
    }
  });

  const errorRows: { row: number; message: string; originalData: any }[] = [];
  const validatedRows: (Omit<TransactionImportRow, 'validated_customer'> & { validated_customer: CustomerValidationResult })[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 because Excel starts at 1 and has header
    let customerSeqRaw = row[customerSequenceField];
    let customerSeq = (customerSeqRaw !== undefined && customerSeqRaw !== null) ? String(customerSeqRaw).trim() : '';

    if (!customerSeq) {
      const availableColumns = Object.keys(row).join(', ');
      errorRows.push({
        row: rowNumber,
        message: `رقم العميل غير موجود. الحقل المطلوب: '${customerSequenceField}'. الأعمدة المتاحة: ${availableColumns}`,
        originalData: row
      });
      return;
    }

    let customer = customerMap.get(customerSeq);

    // Fallback to name matching
    if (!customer && (row['اسم العميل'] || row['الاسم'])) {
      const name = (row['اسم العميل'] || row['الاسم']).toString().trim();
      customer = customerNameMap.get(name);
    }

    if (!customer) {
      errorRows.push({
        row: rowNumber,
        message: `لم يتم العثور على عميل برقم أو اسم '${customerSeq}'`,
        originalData: row
      });
      return;
    }

    const { validated_customer: _, ...restRow } = row as any;
    validatedRows.push({ ...restRow, validated_customer: customer });
  });

  return { errorRows, validatedRows };
};

// Helper to validate and prepare a single transaction row
export const validateAndPrepareTransactionRow = async (
  row: TransactionImportRow,
  mapping: any,
  customerMap: Map<string, { id: string, sequence_number: string }>,
  customerNameMap: Map<string, { id: string, sequence_number: string }>,
  existingSequenceNumbers: Set<string>
) => {
  const rowErrors: string[] = [];
  const newRow: any = {};

  // Validate Customer
  let customerSeqRaw = row[mapping.customer_sequence];
  let customerSeq = (customerSeqRaw !== undefined && customerSeqRaw !== null) ? String(customerSeqRaw).trim() : '';

  if (!customerSeq) {
    rowErrors.push(`رقم العميل غير موجود. الحقل المطلوب: '${mapping.customer_sequence}'`);
  } else {
    let customer = customerMap.get(customerSeq);

    // Fallback to name matching
    if (!customer && (row['اسم العميل'] || row['الاسم'])) {
      const name = (row['اسم العميل'] || row['الاسم']).toString().trim();
      customer = customerNameMap.get(name);
    }

    if (!customer) {
      rowErrors.push(`لم يتم العثور على عميل برقم أو اسم '${customerSeq}'`);
    } else {
      newRow.customer_id = customer.id;
    }
  }

  // Parse numeric fields
  const cost_price = Number(row[mapping.cost_price]) || 0;
  const extra_price = Number(row[mapping.extra_price]) || 0;
  const number_of_installments = Number(row[mapping.number_of_installments]) || 1;
  const mappedAmount = mapping.amount ? (Number(row[mapping.amount]) || 0) : 0;

  if (number_of_installments === 0) {
    rowErrors.push('عدد الدفعات يجب أن يكون أكبر من صفر');
  }

  // Robust date parsing helper
  const parseDate = (value: any): Date => {
    if (!value) return new Date();

    // Handle Excel numeric dates
    const excelDate = Number(value);
    if (!isNaN(excelDate) && excelDate > 25569) { // 25569 is 1970-01-01
      return new Date(Math.round((excelDate - 25569) * 86400 * 1000) + 43200000);
    }

    const dateStr = String(value).trim();

    // Handle DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(dateStr);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      return new Date(year, month, day);
    }

    // Handle YYYY/MM/DD or YYYY-MM-DD
    const yyyymmdd = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(dateStr);
    if (yyyymmdd) {
      const year = parseInt(yyyymmdd[1], 10);
      const month = parseInt(yyyymmdd[2], 10) - 1;
      const day = parseInt(yyyymmdd[3], 10);
      return new Date(year, month, day);
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Parse date
  const start_date = parseDate(row[mapping.start_date]);

  // Check sequence number
  let sequenceNumber = '';
  if (mapping.sequence_number) {
    const seqValue = row[mapping.sequence_number]?.toString() || '';
    if (seqValue && existingSequenceNumbers.has(seqValue)) {
      rowErrors.push(`رقم البيع ${seqValue} موجود بالفعل.`);
    }
    sequenceNumber = seqValue;
  }

  if (rowErrors.length > 0) {
    return { validRow: null, errors: rowErrors };
  }

  // Calculate amounts
  const total_amount = (mappedAmount > 0) ? mappedAmount : (cost_price + extra_price);
  const installment_amount = Math.round((total_amount / number_of_installments) * 1000) / 1000;

  const transaction: Omit<Transaction, 'id' | 'profit'> = {
    sequence_number: sequenceNumber,
    customer_id: newRow.customer_id,
    cost_price,
    extra_price,
    amount: total_amount,
    installment_amount,
    start_date: start_date.toISOString(),
    number_of_installments,
    remaining_balance: total_amount,
    status: 'active',
    has_legal_case: false,
    notes: mapping.notes ? row[mapping.notes]?.toString() || '' : undefined,
    created_at: (mapping.created_at && row[mapping.created_at])
      ? parseDate(row[mapping.created_at]).toISOString()
      : start_date.toISOString()
  };

  // Handle Legacy
  const legacy: any = {};
  if (mapping.legacy_image && row[mapping.legacy_image]) legacy.image = row[mapping.legacy_image].toString();
  if (mapping.legacy_pdf && row[mapping.legacy_pdf]) legacy.pdf = row[mapping.legacy_pdf].toString();

  return { validRow: transaction, legacy, errors: [] };
};

// Import a single transaction row
export const importSingleTransactionRow = async (row: any, mapping: any) => {
  // Fetch dependencies
  const { data: customers } = await supabase.from("customers").select("id, sequence_number, full_name");
  if (!customers) throw new Error("فشل في جلب بيانات العملاء");

  const customerMap = new Map();
  const customerNameMap = new Map();

  customers.forEach(c => {
    if (c.sequence_number) {
      const seqNum = c.sequence_number.toString().trim();
      customerMap.set(seqNum, { id: c.id, sequence_number: c.sequence_number });
      const numericSeq = parseInt(seqNum, 10).toString();
      if (numericSeq !== seqNum) {
        customerMap.set(numericSeq, { id: c.id, sequence_number: c.sequence_number });
      }
    }
    if (c.full_name) {
      customerNameMap.set(c.full_name.trim(), { id: c.id, sequence_number: c.sequence_number || '' });
    }
  });

  const existingSequenceNumbers = new Set<string>();
  if (mapping.sequence_number && row[mapping.sequence_number]) {
    const { data: existing } = await supabase.from("transactions").select("sequence_number").eq('sequence_number', row[mapping.sequence_number]);
    if (existing && existing.length > 0) existingSequenceNumbers.add(row[mapping.sequence_number]);
  }

  const { validRow, legacy, errors } = await validateAndPrepareTransactionRow(row, mapping, customerMap, customerNameMap, existingSequenceNumbers);

  if (errors.length > 0) throw new Error(errors.join('; '));
  if (!validRow) throw new Error("Unknown error");

  const { data: savedTransaction, error } = await supabase.from("transactions").insert([validRow]).select().single();

  if (error) throw error;

  if (legacy && (legacy.image || legacy.pdf)) {
    const attachments = [];
    if (legacy.image) {
      attachments.push({
        transaction_id: savedTransaction.id,
        customer_id: validRow.customer_id,
        file_path: legacy.image,
        file_url: legacy.image,
        file_name: 'Legacy Image',
        file_type: 'image',
        file_size: 0,
        created_at: new Date().toISOString()
      });
    }
    if (legacy.pdf) {
      attachments.push({
        transaction_id: savedTransaction.id,
        customer_id: validRow.customer_id,
        file_path: legacy.pdf,
        file_url: legacy.pdf,
        file_name: 'Legacy PDF',
        file_type: 'application/pdf',
        file_size: 0,
        created_at: new Date().toISOString()
      });
    }
    if (attachments.length > 0) await supabase.from('document_attachments').insert(attachments);
  }

  return true;
};

export const importTransactions = async (
  rows: TransactionImportRow[],
  mapping: {
    customer_sequence: string;
    sequence_number?: string;
    cost_price: string;
    extra_price: string;
    amount?: string;
    number_of_installments: string;
    start_date: string;
    notes?: string;
    created_at?: string;
    legacy_image?: string;
    legacy_pdf?: string;
  }
) => {
  // Validate customers first for bulk efficiency
  const { data: customers } = await supabase.from("customers").select("id, sequence_number, full_name");
  if (!customers) throw new Error("فشل في جلب بيانات العملاء");

  const customerMap = new Map();
  const customerNameMap = new Map();

  customers.forEach(c => {
    if (c.sequence_number) {
      const seqNum = c.sequence_number.toString().trim();
      customerMap.set(seqNum, { id: c.id, sequence_number: c.sequence_number });
      const numericSeq = parseInt(seqNum, 10).toString();
      if (numericSeq !== seqNum) {
        customerMap.set(numericSeq, { id: c.id, sequence_number: c.sequence_number });
      }
    }
    if (c.full_name) {
      customerNameMap.set(c.full_name.trim(), { id: c.id, sequence_number: c.sequence_number || '' });
    }
  });

  // Get existing sequence numbers
  let existingSequenceNumbers = new Set<string>();
  if (mapping.sequence_number) {
    const { data: existingTransactions } = await supabase.from("transactions").select("sequence_number");
    if (existingTransactions) {
      existingSequenceNumbers = new Set(existingTransactions.map(t => t.sequence_number).filter(s => s !== null && s !== ''));
    }
  }

  const allErrors: { row: number; message: string; originalData: any }[] = [];
  const successfulTransactions: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    try {
      const { validRow, legacy, errors } = await validateAndPrepareTransactionRow(row, mapping, customerMap, customerNameMap, existingSequenceNumbers);

      if (errors.length > 0) {
        allErrors.push({ row: rowNumber, message: errors.join('; '), originalData: row });
        continue;
      }

      if (validRow) {
        const { data: savedTransaction, error } = await supabase.from("transactions").insert([validRow]).select().single();

        if (error) {
          allErrors.push({ row: rowNumber, message: error.message, originalData: row });
        } else {
          successfulTransactions.push(savedTransaction);

          if (legacy && (legacy.image || legacy.pdf)) {
            const attachments = [];
            if (legacy.image) {
              attachments.push({
                transaction_id: savedTransaction.id,
                customer_id: validRow.customer_id,
                file_path: legacy.image,
                file_url: legacy.image,
                file_name: 'Legacy Image',
                file_type: 'image',
                file_size: 0,
                created_at: new Date().toISOString()
              });
            }
            if (legacy.pdf) {
              attachments.push({
                transaction_id: savedTransaction.id,
                customer_id: validRow.customer_id,
                file_path: legacy.pdf,
                file_url: legacy.pdf,
                file_name: 'Legacy PDF',
                file_type: 'application/pdf',
                file_size: 0,
                created_at: new Date().toISOString()
              });
            }
            if (attachments.length > 0) await supabase.from('document_attachments').insert(attachments);
          }
        }
      }
    } catch (error: any) {
      allErrors.push({ row: rowNumber, message: error.message || 'خطأ غير متوقع', originalData: row });
    }
  }

  await supabase.rpc('check_overdue_transactions');

  return {
    imported: successfulTransactions.length,
    errors: allErrors,
    transactions: successfulTransactions
  };
};

// Excel column configuration
export const TRANSACTION_TABLE_CONFIG = {
  table: "transactions",
  columns: [
    {
      key: "sequence_number",
      excelHeader: "رقم البيع",
      required: false
    },
    {
      key: "customer_sequence",
      excelHeader: "رقم العميل",
      required: true
    },
    {
      key: "cost_price",
      excelHeader: "سعر السلعة",
      required: false,
      type: "number"
    },
    {
      key: "extra_price",
      excelHeader: "السعر الاضافى",
      required: false,
      type: "number"
    },
    {
      key: "number_of_installments",
      excelHeader: "عدد الدفعات",
      required: false,
      type: "number"
    },
    {
      key: "start_date",
      excelHeader: "تاريخ البدء",
      required: false,
      type: "date"
    },
    {
      key: "notes",
      excelHeader: "ملاحظات",
      required: false
    }
  ]
};
