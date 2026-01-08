export enum ExtractionStatus {
    IDLE = 'IDLE',
    PROCESSING_PDF = 'PROCESSING_PDF',
    ANALYZING_AI = 'ANALYZING_AI',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
}

export interface CaseData {
    sequenceNumber: string;     // م
    automatedNumber: string;    // الرقم الآلي
    entity: string;             // الجهة
    caseType: string;          // النوع
    circleNumber: string;       // رقم الدائرة
    caseNumber: string;         // رقم القضية
    opponent: string;           // الخصم
    sessionDate: string;        // ت. الجلسة
    sessionDecision: string;    // قرار الجلسة
    nextSessionDate: string;    // ت. الجلسة القادمة
    amountDue?: string;         // المبلغ المستحق
    notes?: string;             // ملاحظات / منطوق الحكم
}

export interface PersonInfo {
    name: string;
    civilId: string;
    dateOfReport: string;
    type: string;
}

export interface ExtractedDocument {
    person: PersonInfo;
    cases: CaseData[];
}

export interface StoredLegalCase extends CaseData {
    id: string;
    customer_id: string;
    transaction_id?: string;
    created_at: string;
    updated_at: string;
}

export interface MatchedCase extends CaseData {
    matchedCustomerId?: string;
    matchedCustomerName?: string;
    matchConfidence?: number;
    transactionId?: string;
    availableTransactions?: { id: string; sequence_number: string }[];
    status?: 'new' | 'stored' | 'update';
    existingCaseId?: string;
}
