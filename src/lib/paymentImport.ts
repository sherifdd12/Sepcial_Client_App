import { supabase } from '@/integrations/supabase/client';
import { Payment } from './types';

interface PaymentImportRow {
  [key: string]: string | number;
}

interface PaymentMapping {
  transaction_sequence?: string;  // to match with transaction sequence_number
  customer_sequence?: string;     // to match with customer sequence_number
  amount: string;
  payment_date: string;
  notes?: string;
}

export async function mapAndImportPayments(
  rows: PaymentImportRow[],
  mapping: PaymentMapping
) {
  // First, get all transactions and customers for mapping
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, sequence_number, customer_id, remaining_balance")
    .order("created_at");

  const { data: customers } = await supabase
    .from("customers")
    .select("id, sequence_number")
    .order("created_at");

  if (!transactions || !customers) {
    throw new Error("فشل في جلب بيانات المعاملات أو العملاء");
  }

  const transactionMap = new Map(
    transactions.map(t => [t.sequence_number, { id: t.id, remaining: t.remaining_balance }])
  );

  const customerMap = new Map(
    customers.map(c => [c.sequence_number, c.id])
  );

  // Process payments in chronological order
  const sortedRows = [...rows].sort((a, b) => {
    const dateA = new Date(a[mapping.payment_date]).getTime();
    const dateB = new Date(b[mapping.payment_date]).getTime();
    return dateA - dateB;
  });

  const payments: Payment[] = [];

  for (const row of sortedRows) {
    // Get transaction and customer IDs using sequence numbers
    const transactionSeq = mapping.transaction_sequence ? row[mapping.transaction_sequence]?.toString() : null;
    const customerSeq = mapping.customer_sequence ? row[mapping.customer_sequence]?.toString() : null;
    
    const transaction = transactionSeq ? transactionMap.get(transactionSeq) : null;
    const customer_id = customerSeq ? customerMap.get(customerSeq) : null;

    if (!transaction || !customer_id) {
      throw new Error(`لم يتم العثور على المعاملة ${transactionSeq} أو العميل ${customerSeq}`);
    }

    const amount = Number(row[mapping.amount]);
    const payment_date = new Date(row[mapping.payment_date]).toISOString().split('T')[0];
    const notes = mapping.notes ? row[mapping.notes]?.toString() : '';

    const balance_before = transaction.remaining;
    const balance_after = balance_before - amount;

    if (balance_after < 0) {
      throw new Error(`المبلغ المدفوع ${amount} يتجاوز المبلغ المتبقي ${balance_before} للمعاملة ${transactionSeq}`);
    }

    // Add payment to the list
    payments.push({
      id: crypto.randomUUID(),
      transaction_id: transaction.id,
      customer_id: customer_id as string,
      amount,
      payment_date: new Date(payment_date).toISOString(),
      balance_before,
      balance_after,
      notes,
      created_at: new Date().toISOString()
    } as Payment);

    // Update the transaction's remaining balance in our local map
    transaction.remaining = balance_after;
  }

  // Insert all payments and update transaction balances
  const { data: savedPayments, error } = await supabase
    .from("payments")
    .insert(payments)
    .select();

  if (error) {
    throw error;
  }

  // Update transaction remaining balances
  const transactionUpdates = Array.from(transactionMap.entries()).map(([_, txn]) => ({
    id: txn.id,
    remaining_balance: txn.remaining,
    // Update status based on remaining balance
    status: txn.remaining === 0 ? 'completed' : 
            txn.remaining < 0 ? 'error' : 'active'
  }));

  for (const update of transactionUpdates) {
    await supabase
      .from("transactions")
      .update(update)
      .eq('id', update.id);
  }

  return savedPayments;
}

// Configuration for Excel/CSV columns
export const PAYMENT_TABLE_CONFIG = {
  table: "payments",
  columns: [
    { 
      key: "transaction_sequence", 
      excelHeader: "رقم المعاملة",
      required: true 
    },
    { 
      key: "customer_sequence", 
      excelHeader: "رقم العميل",
      required: true 
    },
    { 
      key: "amount", 
      excelHeader: "المبلغ",
      required: true,
      type: "number" 
    },
    { 
      key: "payment_date", 
      excelHeader: "تاريخ الدفع",
      required: true,
      type: "date" 
    },
    { 
      key: "notes", 
      excelHeader: "ملاحظات",
      required: false 
    }
  ]
};
