// AI features are disabled - these RPC functions don't exist yet
/* 
import { supabase } from '@/integrations/supabase/client';
import type { Payment, Transaction } from './types';

// Calculate risk score for a customer based on their history
export async function calculateCustomerRiskScore(customerId: string): Promise<{ score: number; factors: string[]; }> {
...
  return {
    score: data.score,
    factors: data.factors
  };
}

// Predict likelihood of late payment for a transaction
export async function predictLatePayment(transactionId: string): Promise<{
...
  return {
    probability: data.probability,
    nextPaymentDate: new Date(data.next_payment_date),
    recommendedAction: data.recommended_action
  };
}
*/

import { supabase } from '@/integrations/supabase/client';

// Interface for document extraction result
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

// Placeholder for document extraction function
// This would need to be connected to an actual OCR/NLP service
export async function extractDocumentDetails(documentUrl: string): Promise<DocumentExtractionResult> {
  // This is a placeholder. In a real implementation, you would:
  // 1. Send the document to an OCR service (e.g., Azure Computer Vision, Google Cloud Vision)
  // 2. Process the OCR results with NLP to extract relevant information
  // 3. Validate and structure the extracted data

  throw new Error('Document extraction feature requires integration with an OCR/NLP service');
}

// Interface for chatbot response
export interface ChatbotResponse {
  message: string;
  suggestedActions?: string[];
  data?: any;
}

// Placeholder for chatbot function
// This would need to be connected to an actual NLP/Chatbot service
export async function processChatbotQuery(
  query: string, 
  customerId?: string
): Promise<{
  message: string;
  suggestedActions?: string[];
  data?: any;
}> {
  // This is a placeholder. In a real implementation, you would:
  // 1. Send the query to an NLP service (e.g., Azure Language Understanding, Dialogflow)
  // 2. Process the intent and entities
  // 3. Fetch relevant data from the database
  // 4. Generate appropriate response

  throw new Error('Chatbot feature requires integration with an NLP service');
}

// Helper function to get overdue transactions that need attention
/* Disabled - payment_predictions table doesn't exist
export async function getOverdueTransactionsNeedingAttention() {
  const { data: predictions, error } = await supabase
    .from('payment_predictions')
    .select(`
      *,
      transaction:transactions(*),
      customer:customers(*)
    `)
    .gt('probability', 0.4)
    .order('probability', { ascending: false });

  if (error) throw error;
  return predictions;
}
*/

// Helper function to get high-risk customers using the new RPC
export async function getHighRiskCustomers() {
  const { data, error } = await supabase.rpc('get_high_risk_customers');

  if (error) {
    console.error('Error fetching high risk customers:', error);
    throw error;
  }
  return data;
}
