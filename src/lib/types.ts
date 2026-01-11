// Type definitions for the Arabic Installment Sales Management System

export interface CustomerRiskScore {
  customerId: string;
  score: number;
  factors: string[];
  lastUpdated: Date;
}

export interface PaymentPrediction {
  customerId: string;
  transactionId: string;
  probability: number;
  nextPaymentDate: Date;
  recommendedAction: string;
  lastUpdated: Date;
}

export interface DocumentExtractionResult {
  customerDetails: {
    fullName?: string;
    civilId?: string;
    mobileNumber?: string;
  };
  transactionDetails: {
    amount?: number;
    installmentAmount?: number;
    startDate?: string;
    numberOfInstallments?: number;
  };
  confidenceScore: number;
}

export interface ChatbotResponse {
  message: string;
  suggestedActions?: string[];
  data?: any;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploaded_at: string;
  size: number;
}

export interface Customer {
  id: string;
  sequence_number: string;
  full_name: string;
  mobile_number: string;
  alternate_phone?: string;
  civil_id?: string;
  attachments?: Attachment[];
  tap_customer_id?: string;
  tap_card_id?: string;
  tap_payment_agreement_id?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  sequence_number: string;
  customer_id: string;
  cost_price: number;
  extra_price: number;
  amount: number;
  profit: number;
  installment_amount: number;
  start_date: string;
  number_of_installments: number;
  remaining_balance: number;
  status: 'active' | 'completed' | 'overdue' | 'legal';
  has_legal_case: boolean;
  legal_case_details?: string;
  notes?: string;
  attachments?: Attachment[];
  court_collection_data?: {
    [key: string]: any;
  };
  overdue_amount?: number;
  overdue_installments?: number;
  created_at: string;
  customer?: Customer;
}

export interface Payment {
  id: string;
  transaction_id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  balance_before: number;
  balance_after: number;
  notes?: string;
  attachments?: Attachment[];
  tap_charge_id?: string;
  payment_method?: string;
  created_at: string;
  transaction?: Transaction;
  customer?: Customer;
}

export interface LegalCase {
  id: string;
  customer_id: string;
  case_number: string;
  opponent: string;
  court_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LegalFee {
  id: string;
  customer_id: string;
  transaction_id?: string | null;
  amount: number;
  notes?: string;
  status: 'active' | 'paid' | 'refunded';
  created_at: string;
  updated_at: string;
  transactions?: {
    sequence_number: string;
  };
}

export interface DashboardStats {
  total_customers: number;
  total_active_transactions: number;
  total_revenue: number;
  total_profit: number;
  total_outstanding: number;
  total_overdue: number;
  overdue_transactions: number;
  collected_profit: number;
  tap_revenue?: number;
  court_revenue?: number;
  other_revenue?: number;
  total_legal_fees?: number;
  total_expenses?: number;
  total_customer_receivables?: number;
  tap_revenue: number;
  court_revenue: number;
  other_revenue: number;
  collected_profit: number;
  total_refunds: number;
  total_legal_fees: number;
}

export interface Refund {
  id: string;
  customer_id: string;
  amount: number;
  reason: string;
  refund_date: string;
  created_at: string;
  updated_at: string;
}

export type TransactionStatus = 'active' | 'completed' | 'overdue' | 'legal_case';

export interface ExportRow {
  description: string;
  amount: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  mobileNumber: string;
  dueDate: string;
  reference: string;
  notes: string;
  expiry: string;
}