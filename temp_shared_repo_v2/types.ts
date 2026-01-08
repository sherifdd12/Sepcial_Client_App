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

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

// Global declaration for external libraries loaded via CDN
declare global {
  interface Window {
    pdfjsLib: any;
    XLSX: any;
    html2pdf: any;
  }
}