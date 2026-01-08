import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency in Kuwaiti Dinar
export function formatKWD(amount: number): string {
  return new Intl.NumberFormat('ar-KW', {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

// Alias for formatCurrency
export const formatCurrency = formatKWD;

// Alias for formatDate
export const formatDate = formatArabicDate;

// Format phone number with Kuwait prefix
export function formatPhoneNumber(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('965')) {
    return cleanPhone;
  }
  return `965${cleanPhone}`;
}

// Generate unique transaction ID
export function generateTransactionId(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TXN${year}${month}${day}${random}`;
}

// Generate unique customer ID
export function generateCustomerId(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CUS${year}${month}${random}`;
}

// Format Arabic date
export function formatArabicDate(date: Date): string {
  return new Intl.DateTimeFormat('ar-KW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

// Calculate overdue installments
export function calculateOverdueInstallments(
  firstDueDate: Date,
  monthlyAmount: number,
  totalPaid: number
): { overdueCount: number; overdueAmount: number } {
  const today = new Date();
  const monthsDiff = Math.floor(
    (today.getTime() - firstDueDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  
  const installmentsDue = Math.max(0, monthsDiff + 1);
  const expectedPaid = installmentsDue * monthlyAmount;
  const shortfall = Math.max(0, expectedPaid - totalPaid);
  
  return {
    overdueCount: Math.max(0, Math.floor(shortfall / monthlyAmount)),
    overdueAmount: shortfall,
  };
}

// Generate WhatsApp message URL
export function generateWhatsAppUrl(phoneNumber: string, message: string): string {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}