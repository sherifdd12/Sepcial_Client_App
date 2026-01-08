import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Save, Scan, Search, History, Edit, Trash2, Download, FileSpreadsheet, File as FileIcon, Gavel, Plus } from "lucide-react";
import LegalFeeManager from "./LegalFeeManager";
import { analyzeDocumentImage } from "@/services/legalGeminiService";
import { ExtractedDocument, MatchedCase, StoredLegalCase } from "@/lib/legalTypes";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

enum ExtractionStatus {
    IDLE = "idle",
    PROCESSING_PDF = "processing_pdf",
    ANALYZING_AI = "analyzing_ai",
    COMPLETED = "completed",
    ERROR = "error"
}

export const LegalCaseImporter = () => {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
    const [progress, setProgress] = useState<string>("");
    const [extractedCases, setExtractedCases] = useState<MatchedCase[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [historySearchTerm, setHistorySearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("history");
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [editingCase, setEditingCase] = useState<any>(null);
    const [isAddingCase, setIsAddingCase] = useState(false);
    const [showCustomerStats, setShowCustomerStats] = useState(false);
    const [includeStatsInExport, setIncludeStatsInExport] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    // Fetch customers for matching
    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("customers")
                .select("id, full_name, mobile_number, sequence_number");
            if (error) throw error;
            return data;
        },
    });

    // Fetch all transactions for matching
    const { data: allTransactions } = useQuery({
        queryKey: ["all_transactions"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("transactions")
                .select("id, customer_id, sequence_number, status");
            if (error) throw error;
            return data;
        },
    });

    // Fetch stored legal cases with stats from the view
    const { data: storedCases, isLoading: isLoadingHistory, error: historyError } = useQuery({
        queryKey: ["legal_cases_stats"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from('legal_cases_with_stats')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;

            return data.map((c: any) => ({
                ...c,
                customers: {
                    full_name: c.customer_name,
                    sequence_number: c.customer_sequence
                },
                transactions: c.transaction_id ? {
                    sequence_number: c.transaction_sequence
                } : null
            }));
        },
    });

    const normalizeName = (name: string | null | undefined) => {
        if (!name) return "";
        return name
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/عبد\s/g, 'عبد')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const findBestMatch = (officialName: string | null | undefined): { customerId?: string, customerName?: string, confidence: number } => {
        if (!customers || !officialName) return { confidence: 0 };

        const normalizedOfficial = normalizeName(officialName);
        const officialParts = normalizedOfficial.split(' ');

        let bestMatch = null;
        let maxConfidence = 0;

        for (const customer of customers) {
            const normalizedCustomer = normalizeName(customer.full_name);
            const customerParts = normalizedCustomer.split(' ');

            let matchCount = 0;
            for (const part of customerParts) {
                if (officialParts.includes(part)) {
                    matchCount++;
                }
            }

            const confidence = matchCount / customerParts.length;
            if (confidence > maxConfidence && confidence >= 0.5) {
                maxConfidence = confidence;
                bestMatch = customer;
            }
        }

        if (bestMatch) {
            return {
                customerId: bestMatch.id,
                customerName: bestMatch.full_name,
                confidence: maxConfidence
            };
        }
        return { confidence: 0 };
    };

    const processFile = async (file: File) => {
        try {
            setStatus(ExtractionStatus.PROCESSING_PDF);
            setProgress("جاري قراءة ملف PDF...");

            await new Promise(resolve => setTimeout(resolve, 1000));

            setStatus(ExtractionStatus.ANALYZING_AI);
            setProgress("جاري تحليل البيانات بواسطة الذكاء الاصطناعي...");

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64 = (reader.result as string).split(',')[1];
                    const mimeType = file.type || "application/pdf";
                    const extractedData = await analyzeDocumentImage(base64, mimeType);

                    // Fetch existing cases for comparison
                    const { data: existingCases } = await supabase
                        .from('legal_cases')
                        .select('*');

                    // Match cases with customers and check for duplicates/updates
                    const matched: MatchedCase[] = (extractedData.cases || []).map(c => {
                        const match = findBestMatch(c.opponent);

                        // Fallback for caseNumber if missing (critical fix)
                        const caseNumber = c.caseNumber || c.automatedNumber || "Unknown";

                        // Find available transactions for the matched customer
                        let availableTransactions: { id: string, sequence_number: string }[] = [];
                        let transactionId = undefined;

                        if (match.customerId && allTransactions) {
                            const customerTransactions = allTransactions.filter(t => t.customer_id === match.customerId);
                            if (customerTransactions.length > 0) {
                                customerTransactions.sort((a, b) => parseInt(b.sequence_number || '0') - parseInt(a.sequence_number || '0'));
                                availableTransactions = customerTransactions.map(t => ({
                                    id: t.id,
                                    sequence_number: `${t.sequence_number || 'N/A'} (${t.status === 'active' ? 'نشطة' : t.status === 'completed' ? 'مكتملة' : t.status === 'late' ? 'متاخرة' : t.status})`
                                }));
                                transactionId = customerTransactions[0].id;
                            }
                        }

                        // Check for duplicate/update
                        let status: 'new' | 'stored' | 'update' = 'new';
                        let existingCaseId = undefined;

                        if (existingCases) {
                            const existing = existingCases.find(ec => ec.case_number === caseNumber);
                            if (existing) {
                                existingCaseId = existing.id;
                                // Compare critical fields
                                const isSame =
                                    existing.session_date === c.sessionDate &&
                                    existing.session_decision === c.sessionDecision &&
                                    existing.next_session_date === c.nextSessionDate;

                                status = isSame ? 'stored' : 'update';
                            }
                        }

                        return {
                            ...c,
                            caseNumber, // Use the fallback
                            matchedCustomerId: match.customerId,
                            matchedCustomerName: match.customerName,
                            matchConfidence: match.confidence,
                            transactionId: transactionId,
                            availableTransactions: availableTransactions,
                            status,
                            existingCaseId
                        };
                    });

                    setExtractedCases(matched);
                    setStatus(ExtractionStatus.COMPLETED);
                } catch (error: any) {
                    console.error("AI Analysis Error:", error);
                    toast({
                        title: "خطأ في التحليل",
                        description: error.message || "فشل تحليل المستند",
                        variant: "destructive"
                    });
                    setStatus(ExtractionStatus.ERROR);
                }
            };
        } catch (error) {
            console.error("Processing Error:", error);
            setStatus(ExtractionStatus.ERROR);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const updateMutation = useMutation({
        mutationFn: async (caseData: MatchedCase) => {
            if (!caseData.matchedCustomerId) throw new Error("No customer selected");
            if (!caseData.caseNumber || caseData.caseNumber === "Unknown") {
                throw new Error(`رقم القضية مفقود للخصم: ${caseData.opponent}`);
            }

            // 1. Save to legal_cases table
            const casePayload = {
                customer_id: caseData.matchedCustomerId,
                transaction_id: caseData.transactionId,
                case_number: caseData.caseNumber,
                automated_number: caseData.automatedNumber,
                entity: caseData.entity,
                circle_number: caseData.circleNumber,
                opponent: caseData.opponent,
                session_date: caseData.sessionDate,
                session_decision: caseData.sessionDecision,
                next_session_date: caseData.nextSessionDate,
                amount_due: caseData.amountDue,
                notes: caseData.notes,
            };

            let error;
            if (caseData.existingCaseId) {
                const { error: updateError } = await supabase
                    .from('legal_cases')
                    .update(casePayload)
                    .eq('id', caseData.existingCaseId);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('legal_cases')
                    .insert(casePayload);
                error = insertError;
            }

            if (error) throw error;

            // 2. Backup to transactions table (legacy support)
            if (caseData.transactionId) {
                const { data: currentTransaction } = await supabase
                    .from('transactions')
                    .select('legal_case_details')
                    .eq('id', caseData.transactionId)
                    .single();

                const timestamp = new Date().toLocaleString('ar-KW');
                const newDetails = `
--- تحديث من ملف قضايا (${timestamp}) ---
رقم القضية: ${caseData.caseNumber}
القرار: ${caseData.sessionDecision || 'لا يوجد'}
الجلسة: ${caseData.sessionDate}
----------------------------------------
`;
                const updatedDetails = currentTransaction?.legal_case_details
                    ? `${currentTransaction.legal_case_details}\n${newDetails}`
                    : newDetails;

                await supabase
                    .from('transactions')
                    .update({
                        has_legal_case: true,
                        legal_case_details: updatedDetails,
                    })
                    .eq('id', caseData.transactionId);
            }
        },
        onSuccess: () => {
            toast({ title: "تم الحفظ بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["legal_cases"] });
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
        },
        onError: (error) => {
            toast({ title: "خطأ في الحفظ", description: error.message, variant: "destructive" });
        }
    });

    const handleConfirmUpdate = (caseData: MatchedCase) => {
        if (!caseData.matchedCustomerId) return;
        updateMutation.mutate(caseData);
    };

    const [searchTerm, setSearchTerm] = useState("");
    const filteredCustomers = customers?.filter(c =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.mobile_number?.includes(searchTerm)
    ).slice(0, 10) || [];

    const handleManualLink = (caseIndex: number, customerId: string) => {
        const customer = customers?.find(c => c.id === customerId);
        if (!customer) return;

        const updatedCases = [...extractedCases];
        updatedCases[caseIndex] = {
            ...updatedCases[caseIndex],
            matchedCustomerId: customer.id,
            matchedCustomerName: customer.full_name,
            matchConfidence: 1,
            transactionId: undefined,
            availableTransactions: []
        };

        if (allTransactions) {
            const customerTransactions = allTransactions.filter(t => t.customer_id === customer.id);
            if (customerTransactions.length > 0) {
                customerTransactions.sort((a, b) => parseInt(b.sequence_number || '0') - parseInt(a.sequence_number || '0'));
                updatedCases[caseIndex].transactionId = customerTransactions[0].id;
                updatedCases[caseIndex].availableTransactions = customerTransactions.map(t => ({
                    id: t.id!,
                    sequence_number: `${t.sequence_number || 'N/A'} (${t.status === 'active' ? 'نشطة' : t.status === 'completed' ? 'مكتملة' : t.status === 'late' ? 'متاخرة' : t.status})`
                }));
            }
        }
        setExtractedCases(updatedCases);
    };

    const handleApproveAll = async () => {
        const casesToUpdate = extractedCases.filter(c => c.matchedCustomerId && c.status !== 'stored');
        if (casesToUpdate.length === 0) {
            toast({ title: "لا توجد قضايا جديدة أو محدثة للاعتماد", variant: "default" });
            return;
        }

        setIsProcessing(true);
        try {
            for (const c of casesToUpdate) {
                // Skip if caseNumber is missing even after fallback
                if (!c.caseNumber || c.caseNumber === "Unknown") {
                    console.warn("Skipping case with missing caseNumber:", c.opponent);
                    continue;
                }
                await updateMutation.mutateAsync(c);
            }
            toast({ title: "تم اعتماد جميع القضايا بنجاح" });
            setStatus(ExtractionStatus.IDLE);
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredHistory = useMemo(() => {
        if (!storedCases) return [];
        const term = historySearchTerm.toLowerCase();
        return storedCases.filter(c =>
            c.case_number?.toLowerCase().includes(term) ||
            c.opponent?.toLowerCase().includes(term) ||
            c.customers?.full_name?.toLowerCase().includes(term) ||
            c.transactions?.sequence_number?.toString().includes(term)
        );
    }, [storedCases, historySearchTerm]);

    const toggleHistorySelection = (id: string) => {
        setSelectedHistoryIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAllHistory = () => {
        if (selectedHistoryIds.length === filteredHistory.length) {
            setSelectedHistoryIds([]);
        } else {
            setSelectedHistoryIds(filteredHistory.map(c => c.id));
        }
    };

    const exportToExcel = () => {
        const dataToExport = selectedHistoryIds.length > 0
            ? filteredHistory.filter(c => selectedHistoryIds.includes(c.id))
            : filteredHistory;

        const worksheet = XLSX.utils.json_to_sheet(dataToExport.map(c => {
            const baseData: any = {
                "العميل": c.customers?.full_name,
                "رقم المعاملة": c.transactions?.sequence_number,
                "رقم القضية": c.case_number,
                "الرقم الآلي": c.automated_number,
                "الخصم": c.opponent,
                "الجهة": c.entity,
                "تاريخ الجلسة": c.session_date,
                "قرار الجلسة": c.session_decision,
                "الجلسة القادمة": c.next_session_date,
                "المبلغ": c.amount_due,
                "ملاحظات": c.notes
            };

            if (includeStatsInExport) {
                baseData["عدد المعاملات"] = c.transactions_count;
                baseData["إجمالي المديونية"] = c.total_debt;
                baseData["إجمالي المدفوع"] = c.total_paid;
                baseData["تاريخ آخر دفعة"] = c.last_payment_date;
                baseData["مبلغ آخر دفعة"] = c.last_payment_amount;
            }

            return baseData;
        }));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "القضايا القانونية");

        // Set RTL for the workbook
        if (!workbook.Workbook) workbook.Workbook = {};
        if (!workbook.Workbook.Views) workbook.Workbook.Views = [];
        workbook.Workbook.Views[0] = { RTL: true };

        XLSX.writeFile(workbook, `legal_cases_${new Date().toLocaleDateString()}.xlsx`);
        toast({ title: "تم تصدير ملف Excel بنجاح (RTL)" });
    };

    const exportToPDF = async () => {
        setIsExporting(true);
        toast({ title: "جاري تجهيز ملف PDF...", description: "يرجى الانتظار قليلاً لمعالجة النصوص العربية" });

        // Wait for state update to render the hidden export table
        setTimeout(async () => {
            try {
                const element = exportRef.current;
                if (!element) return;

                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: "#ffffff",
                    windowWidth: 1200,
                    height: element.scrollHeight,
                    windowHeight: element.scrollHeight
                });

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                const imgProps = pdf.getImageProperties(imgData);
                const imgWidth = pdfWidth;
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                let heightLeft = imgHeight;
                let position = 0;

                // Add first page
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;

                // Add subsequent pages if needed
                while (heightLeft >= 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }

                pdf.save(`legal_cases_${new Date().toLocaleDateString()}.pdf`);
                toast({ title: "تم تصدير ملف PDF بنجاح" });
            } catch (error) {
                console.error("PDF Export Error:", error);
                toast({ title: "خطأ في تصدير PDF", variant: "destructive" });
            } finally {
                setIsExporting(false);
            }
        }, 500);
    };

    const handleDeleteCase = async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذه القضية؟")) return;
        const { error } = await supabase.from('legal_cases').delete().eq('id', id);
        if (error) {
            toast({ title: "خطأ في الحذف", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "تم الحذف بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["legal_cases"] });
        }
    };

    const editMutation = useMutation({
        mutationFn: async (caseData: any) => {
            const { error } = await supabase
                .from('legal_cases')
                .update({
                    case_number: caseData.case_number,
                    automated_number: caseData.automated_number,
                    entity: caseData.entity,
                    opponent: caseData.opponent,
                    session_date: caseData.session_date,
                    session_decision: caseData.session_decision,
                    next_session_date: caseData.next_session_date,
                    notes: caseData.notes,
                })
                .eq('id', caseData.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "تم تحديث القضية بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["legal_cases"] });
            setEditingCase(null);
        },
        onError: (error: any) => {
            toast({ title: "خطأ في التحديث", description: error.message, variant: "destructive" });
        }
    });

    const addMutation = useMutation({
        mutationFn: async (newCase: any) => {
            const { data, error } = await supabase
                .from("legal_cases")
                .insert([{
                    customer_id: newCase.customer_id,
                    case_number: newCase.case_number,
                    automated_number: newCase.automated_number,
                    entity: newCase.entity,
                    opponent: newCase.opponent,
                    session_date: newCase.session_date,
                    session_decision: newCase.session_decision,
                    next_session_date: newCase.next_session_date,
                    notes: newCase.notes,
                }])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["legal_cases_stats"] });
            toast({ title: "تم إضافة القضية بنجاح" });
            setIsAddingCase(false);
            setEditingCase(null);
        },
        onError: (error: any) => {
            toast({
                title: "خطأ في إضافة القضية",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleEditSave = () => {
        if (!editingCase) return;
        if (isAddingCase) {
            addMutation.mutate(editingCase);
        } else {
            editMutation.mutate(editingCase);
        }
    };

    const dataToExport = (selectedHistoryIds.length > 0
        ? filteredHistory.filter(c => selectedHistoryIds.includes(c.id))
        : filteredHistory).sort((a, b) => {
            const nameA = a.customers?.full_name || '';
            const nameB = b.customers?.full_name || '';
            return nameA.localeCompare(nameB, 'ar');
        });

    return (
        <div className="space-y-6 p-6 bg-gray-50 rounded-xl shadow-sm border border-gray-100 min-h-[600px]">
            {/* Hidden Table for PDF Export (Handles Arabic via html2canvas) */}
            <div className="fixed -left-[9999px] top-0">
                <div ref={exportRef} className="p-8 bg-white w-[1200px] text-right h-auto overflow-visible" dir="rtl">
                    <h1 className="text-2xl font-bold mb-6 text-center border-b pb-4">تقرير القضايا القانونية</h1>
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-2">العميل</th>
                                <th className="border border-gray-300 p-2">المعاملة</th>
                                <th className="border border-gray-300 p-2">رقم القضية</th>
                                <th className="border border-gray-300 p-2">الرقم الآلي</th>
                                <th className="border border-gray-300 p-2">الخصم</th>
                                <th className="border border-gray-300 p-2">تاريخ الجلسة</th>
                                <th className="border border-gray-300 p-2">القرار</th>
                                {includeStatsInExport && (
                                    <>
                                        <th className="border border-gray-300 p-2">عدد المعاملات</th>
                                        <th className="border border-gray-300 p-2">إجمالي المديونية</th>
                                        <th className="border border-gray-300 p-2">إجمالي المدفوع</th>
                                        <th className="border border-gray-300 p-2">آخر دفعة</th>
                                    </>
                                )}
                                <th className="border border-gray-300 p-2">ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dataToExport.map((c, i) => (
                                <tr key={i}>
                                    <td className="border border-gray-300 p-2">{c.customers?.full_name}</td>
                                    <td className="border border-gray-300 p-2">{c.transactions?.sequence_number}</td>
                                    <td className="border border-gray-300 p-2">{c.case_number}</td>
                                    <td className="border border-gray-300 p-2">{c.automated_number || '-'}</td>
                                    <td className="border border-gray-300 p-2">{c.opponent}</td>
                                    <td className="border border-gray-300 p-2">{c.session_date}</td>
                                    <td className="border border-gray-300 p-2">{c.session_decision}</td>
                                    {includeStatsInExport && (
                                        <>
                                            <td className="border border-gray-300 p-2 text-center">{c.transactions_count}</td>
                                            <td className="border border-gray-300 p-2 text-center">{c.total_debt} د.ك</td>
                                            <td className="border border-gray-300 p-2 text-center">{c.total_paid} د.ك</td>
                                            <td className="border border-gray-300 p-2 text-center">
                                                {c.last_payment_date ? `${c.last_payment_date} (${c.last_payment_amount} د.ك)` : 'لا يوجد'}
                                            </td>
                                        </>
                                    )}
                                    <td className="border border-gray-300 p-2">{c.notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4 text-xs text-gray-400">تم الاستخراج في: {new Date().toLocaleString('ar-KW')}</div>
                </div>
            </div>

            <div className="text-center max-w-2xl mx-auto mb-8">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-200">
                    <FileText size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">إدارة القضايا القانونية</h2>
                <p className="text-gray-500">
                    نظام ذكي لاستخراج البيانات من ملفات وزارة العدل ومطابقتها مع العملاء تلقائياً.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex flex-col sm:grid sm:grid-cols-3 w-full max-w-xl mx-auto h-auto sm:h-10 gap-2 sm:gap-0 mb-8 bg-muted/50 p-1">
                    <TabsTrigger value="import" className="flex items-center gap-2 w-full justify-center">
                        <Upload size={16} />
                        استيراد جديد
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2 w-full justify-center">
                        <History size={16} />
                        القضايا المسجلة
                    </TabsTrigger>
                    <TabsTrigger value="legal-fees" className="flex items-center gap-2 w-full justify-center">
                        <Gavel size={16} />
                        الأتعاب القانونية
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="import">
                    {status === ExtractionStatus.IDLE && (
                        <div className="flex justify-center py-12">
                            <label className="relative cursor-pointer bg-white hover:bg-gray-50 text-gray-700 font-medium py-12 px-8 rounded-xl shadow-sm transition-all flex flex-col items-center gap-4 w-full max-w-xl border-2 border-dashed border-gray-300 hover:border-blue-500 group">
                                <div className="p-4 bg-blue-50 text-blue-600 rounded-full group-hover:scale-110 transition-transform">
                                    <Upload size={32} />
                                </div>
                                <div className="text-center">
                                    <span className="block text-lg font-semibold text-gray-900">اضغط لرفع ملف PDF</span>
                                    <span className="text-sm text-gray-500">سيتم تحليل الملف ومطابقته تلقائياً</span>
                                </div>
                                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}

                    {(status === ExtractionStatus.PROCESSING_PDF || status === ExtractionStatus.ANALYZING_AI) && (
                        <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                                <Loader2 className="absolute inset-0 m-auto text-blue-600 animate-pulse" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">جاري المعالجة الذكية</h3>
                            <p className="text-gray-500 animate-pulse">{progress}</p>
                        </div>
                    )}

                    {status === ExtractionStatus.COMPLETED && extractedCases.length > 0 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                                        <CheckCircle size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">تم استخراج {extractedCases.length} قضية</h3>
                                        <p className="text-sm text-gray-500">يرجى مراجعة المطابقات أدناه وتأكيد التحديث.</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleApproveAll}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} className="mr-2" />}
                                        اعتماد الكل ({extractedCases.filter(c => c.matchedCustomerId && c.status !== 'stored').length})
                                    </Button>
                                    <Button variant="outline" onClick={() => setStatus(ExtractionStatus.IDLE)}>رفع ملف جديد</Button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-gray-50">
                                            <TableRow>
                                                <TableHead className="text-right py-4 font-semibold text-gray-700 min-w-[200px]">بيانات القضية</TableHead>
                                                <TableHead className="text-right py-4 font-semibold text-gray-700 min-w-[150px]">تفاصيل الجلسة</TableHead>
                                                <TableHead className="text-right py-4 font-semibold text-gray-700 min-w-[200px]">العميل المطابق</TableHead>
                                                <TableHead className="text-right py-4 font-semibold text-gray-700 min-w-[200px]">ربط المعاملة</TableHead>
                                                <TableHead className="text-right py-4 font-semibold text-gray-700">الحالة / الإجراء</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {extractedCases.map((c, idx) => (
                                                <TableRow key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                    <TableCell className="align-top">
                                                        <div className="space-y-1">
                                                            <div className="font-bold text-gray-900">{c.opponent}</div>
                                                            <div className="text-sm text-gray-500 flex flex-wrap gap-2">
                                                                <Badge variant="secondary" className="text-xs font-normal">{c.caseNumber}</Badge>
                                                                <Badge variant="outline" className="text-xs font-normal">{c.automatedNumber || 'بدون رقم آلي'}</Badge>
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                <span className="font-semibold">الجهة:</span> {c.entity}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        <div className="space-y-1 text-sm">
                                                            <div><span className="text-gray-500">تاريخ الجلسة:</span> {c.sessionDate}</div>
                                                            <div><span className="text-gray-500">القرار:</span> <span className="font-medium text-blue-700">{c.sessionDecision}</span></div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        {c.matchedCustomerName ? (
                                                            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 relative">
                                                                <div className="font-bold text-blue-900">{c.matchedCustomerName}</div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                                                                        <div
                                                                            style={{ "--match-width": `${(c.matchConfidence || 0) * 100}%` } as React.CSSProperties}
                                                                            className="h-full bg-green-500 rounded-full w-[var(--match-width)]"
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs text-green-700 font-medium">{Math.round((c.matchConfidence || 0) * 100)}% تطابق</span>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="mt-2 h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100/50 w-full justify-start px-2"
                                                                    onClick={() => {
                                                                        const updatedCases = [...extractedCases];
                                                                        updatedCases[idx] = { ...updatedCases[idx], matchedCustomerName: undefined, matchedCustomerId: undefined, transactionId: undefined };
                                                                        setExtractedCases(updatedCases);
                                                                    }}
                                                                >
                                                                    تغيير العميل
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <Select onValueChange={(val) => handleManualLink(idx, val)}>
                                                                    <SelectTrigger className="w-full bg-white border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                                                                        <SelectValue placeholder="بحث يدوي عن عميل..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <div className="p-2">
                                                                            <input
                                                                                className="w-full p-2 border rounded text-sm mb-2"
                                                                                placeholder="ابحث بالاسم أو الرقم..."
                                                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                            />
                                                                        </div>
                                                                        {filteredCustomers.map(cust => (
                                                                            <SelectItem key={cust.id} value={cust.id}>
                                                                                {cust.full_name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        {c.availableTransactions && c.availableTransactions.length > 0 ? (
                                                            <Select
                                                                value={c.transactionId}
                                                                onValueChange={(value) => {
                                                                    const updatedCases = [...extractedCases];
                                                                    updatedCases[idx].transactionId = value;
                                                                    setExtractedCases(updatedCases);
                                                                }}
                                                            >
                                                                <SelectTrigger className="w-full bg-white border-gray-300">
                                                                    <SelectValue placeholder="اختر المعاملة" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {c.availableTransactions.map((t) => (
                                                                        <SelectItem key={t.id} value={t.id}>
                                                                            معاملة #{t.sequence_number}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <span className="text-sm text-gray-400 italic">لا توجد معاملات</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="align-top">
                                                        <div className="space-y-2">
                                                            {c.status === 'stored' ? (
                                                                <Badge className="w-full justify-center bg-gray-100 text-gray-600 border-none py-1.5">
                                                                    <CheckCircle size={14} className="mr-1" />
                                                                    مضافة مسبقاً
                                                                </Badge>
                                                            ) : c.status === 'update' ? (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleConfirmUpdate(c)}
                                                                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                                                                    disabled={updateMutation.isPending}
                                                                >
                                                                    {updateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} className="mr-1" />}
                                                                    تحديث البيانات
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    disabled={!c.matchedCustomerId || updateMutation.isPending}
                                                                    onClick={() => handleConfirmUpdate(c)}
                                                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                                                >
                                                                    {updateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} className="mr-1" />}
                                                                    اعتماد وحفظ
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-4 p-4 bg-gray-50">
                                    {extractedCases.map((c, idx) => (
                                        <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{c.opponent}</h4>
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        <Badge variant="secondary" className="text-xs">{c.caseNumber}</Badge>
                                                        {c.automatedNumber && <Badge variant="outline" className="text-xs">{c.automatedNumber}</Badge>}
                                                    </div>
                                                </div>
                                                {c.status === 'stored' && (
                                                    <Badge className="bg-gray-100 text-gray-600 border-none">مضافة</Badge>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <span className="text-gray-500 text-xs block">تاريخ الجلسة</span>
                                                    <span className="font-medium">{c.sessionDate}</span>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded">
                                                    <span className="text-gray-500 text-xs block">القرار</span>
                                                    <span className="font-medium text-blue-700">{c.sessionDecision}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-xs text-gray-500">العميل المطابق</Label>
                                                {c.matchedCustomerName ? (
                                                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-blue-900 text-sm">{c.matchedCustomerName}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs text-blue-600"
                                                                onClick={() => {
                                                                    const updatedCases = [...extractedCases];
                                                                    updatedCases[idx] = { ...updatedCases[idx], matchedCustomerName: undefined, matchedCustomerId: undefined, transactionId: undefined };
                                                                    setExtractedCases(updatedCases);
                                                                }}
                                                            >
                                                                تغيير
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Select onValueChange={(val) => handleManualLink(idx, val)}>
                                                        <SelectTrigger className="w-full text-sm">
                                                            <SelectValue placeholder="بحث عن عميل..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <div className="p-2">
                                                                <input
                                                                    className="w-full p-2 border rounded text-sm mb-2"
                                                                    placeholder="بحث..."
                                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                                    onKeyDown={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                            {filteredCustomers.map(cust => (
                                                                <SelectItem key={cust.id} value={cust.id}>{cust.full_name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>

                                            {c.matchedCustomerId && (
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-gray-500">ربط المعاملة</Label>
                                                    {c.availableTransactions && c.availableTransactions.length > 0 ? (
                                                        <Select
                                                            value={c.transactionId}
                                                            onValueChange={(value) => {
                                                                const updatedCases = [...extractedCases];
                                                                updatedCases[idx].transactionId = value;
                                                                setExtractedCases(updatedCases);
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-full text-sm">
                                                                <SelectValue placeholder="اختر المعاملة" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {c.availableTransactions.map((t) => (
                                                                    <SelectItem key={t.id} value={t.id}>#{t.sequence_number}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <div className="text-sm text-gray-400 italic bg-gray-50 p-2 rounded">لا توجد معاملات</div>
                                                    )}
                                                </div>
                                            )}

                                            {c.status !== 'stored' && (
                                                <Button
                                                    className="w-full"
                                                    disabled={!c.matchedCustomerId || updateMutation.isPending}
                                                    onClick={() => handleConfirmUpdate(c)}
                                                    variant={c.status === 'update' ? "default" : "default"} // Use default (blue) for both for simplicity or customize
                                                >
                                                    {updateMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} className="mr-2" />}
                                                    {c.status === 'update' ? 'تحديث البيانات' : 'اعتماد وحفظ'}
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="history">
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                                <div className="relative w-full md:w-80">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <Input
                                        placeholder="ابحث برقم القضية، اسم العميل، أو رقم المعاملة..."
                                        className="pr-10 bg-gray-50 border-gray-200 focus:bg-white transition-all"
                                        value={historySearchTerm}
                                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="show-stats"
                                            checked={showCustomerStats}
                                            onCheckedChange={(checked) => setShowCustomerStats(!!checked)}
                                        />
                                        <Label htmlFor="show-stats" className="text-xs cursor-pointer">عرض إحصائيات العميل</Label>
                                    </div>
                                    <div className="w-px h-4 bg-gray-300" />
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="export-stats"
                                            checked={includeStatsInExport}
                                            onCheckedChange={(checked) => setIncludeStatsInExport(!!checked)}
                                        />
                                        <Label htmlFor="export-stats" className="text-xs cursor-pointer">تضمين في التصدير</Label>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={exportToExcel} className="flex items-center gap-2">
                                        <FileSpreadsheet size={16} className="text-green-600" />
                                        Excel
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={exportToPDF}
                                        disabled={isExporting}
                                        className="flex items-center gap-2"
                                    >
                                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileIcon size={16} className="text-red-600" />}
                                        PDF
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setIsAddingCase(true);
                                            setEditingCase({
                                                opponent: "",
                                                case_number: "",
                                                automated_number: "",
                                                entity: "",
                                                session_date: "",
                                                next_session_date: "",
                                                session_decision: "",
                                                notes: "",
                                                amount_due: ""
                                            });
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        <Plus size={16} />
                                        إضافة قضية
                                    </Button>
                                </div>
                            </div>
                            <div className="text-sm text-gray-500">
                                إجمالي القضايا المسجلة: <span className="font-bold text-blue-600">{filteredHistory.length}</span>
                                {selectedHistoryIds.length > 0 && (
                                    <span className="mr-2 text-amber-600">({selectedHistoryIds.length} محددة)</span>
                                )}
                            </div>
                        </div>

                        {isLoadingHistory ? (
                            <div className="text-center py-20">
                                <Loader2 className="mx-auto animate-spin text-blue-600 mb-4" size={48} />
                                <p className="text-gray-500">جاري تحميل السجل...</p>
                            </div>
                        ) : historyError ? (
                            <div className="text-center py-20 bg-red-50 rounded-xl border border-red-100">
                                <p className="text-red-600 font-bold mb-2">حدث خطأ أثناء تحميل البيانات</p>
                                <p className="text-sm text-red-500">{(historyError as any).message || "يرجى التأكد من تشغيل ملف SQL الخاص بالـ View"}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => window.location.reload()}
                                >
                                    إعادة تحميل الصفحة
                                </Button>
                            </div>
                        ) : filteredHistory.length > 0 ? (
                            <div className="md:hidden space-y-4">
                                {filteredHistory.length === 0 ? (
                                    <div className="text-center p-8 text-muted-foreground bg-white rounded-lg border border-dashed">لا توجد قضايا مسجلة</div>
                                ) : (
                                    filteredHistory.map((c) => (
                                        <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-xs font-normal bg-gray-50">{c.case_number}</Badge>
                                                        <Badge variant={c.session_decision ? "default" : "secondary"} className="text-[10px] h-5">
                                                            {c.session_decision || 'لا يوجد قرار'}
                                                        </Badge>
                                                    </div>
                                                    <h4 className="font-bold text-gray-900 text-lg">{c.opponent}</h4>
                                                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                        <User size={12} />
                                                        {c.customers?.full_name || 'غير مرتبط بعميل'}
                                                    </div>
                                                </div>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => {
                                                            setEditingCase(c);
                                                            setIsAddingCase(false);
                                                        }}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            تعديل
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDeleteCase(c.id)} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            حذف
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-lg">
                                                <div>
                                                    <span className="text-gray-500 text-xs block mb-1">تاريخ الجلسة</span>
                                                    <span className="font-medium flex items-center gap-1">
                                                        <Calendar size={12} className="text-blue-500" />
                                                        {c.session_date}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 text-xs block mb-1">المبلغ المطالب به</span>
                                                    <span className="font-bold text-red-600">{c.amount_due || '-'}</span>
                                                </div>
                                            </div>

                                            <Button
                                                variant="outline"
                                                className="w-full mt-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                                onClick={() => {
                                                    setEditingCase(c);
                                                    setIsAddingCase(false);
                                                }}
                                            >
                                                <Eye className="mr-2 h-4 w-4" />
                                                عرض التفاصيل
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                                                            checked={selectedHistoryIds.includes(c.id)}
                        onCheckedChange={() => toggleHistorySelection(c.id)}
                                                        />
                    </TableCell>
                    <TableCell className="align-top">
                        <div className="space-y-1">
                            <div className="font-bold text-gray-900">{c.customers?.full_name}</div>
                            {c.transactions && (
                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-100 bg-blue-50">
                                    معاملة #{c.transactions.sequence_number}
                                </Badge>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="align-top">
                        <div className="space-y-1">
                            <div className="font-bold text-gray-900">{c.opponent}</div>
                            <div className="text-sm text-gray-500 flex flex-wrap gap-2">
                                <Badge variant="secondary" className="text-xs font-normal">{c.case_number}</Badge>
                                <Badge variant="outline" className="text-xs font-normal">{c.automated_number || 'بدون رقم آلي'}</Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                <span className="font-semibold">الجهة:</span> {c.entity}
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                            <div><span className="text-gray-500">تاريخ الجلسة:</span> {c.session_date}</div>
                            <div><span className="text-gray-500">القرار:</span> <span className="font-medium text-blue-700">{c.session_decision}</span></div>
                        </div>
                    </TableCell>
                    {showCustomerStats && (
                        <>
                            <TableCell className="align-top">
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-start gap-2">
                                        <span className="text-gray-500">عدد المعاملات:</span>
                                        <span className="font-medium">{c.transactions_count}</span>
                                    </div>
                                    <div className="flex justify-start gap-2">
                                        <span className="text-gray-500">إجمالي المديونية:</span>
                                        <span className="font-bold text-red-600">{c.total_debt} د.ك</span>
                                    </div>
                                    <div className="flex justify-start gap-2">
                                        <span className="text-gray-500">إجمالي المدفوع:</span>
                                        <span className="font-bold text-green-600">{c.total_paid} د.ك</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="align-top">
                                <div className="space-y-1 text-xs">
                                    {c.last_payment_date ? (
                                        <>
                                            <div className="font-medium text-gray-900">{c.last_payment_date}</div>
                                            <div className="text-blue-600 font-bold">{c.last_payment_amount} د.ك</div>
                                        </>
                                    ) : (
                                        <span className="text-gray-400 italic">لا توجد دفعات</span>
                                    )}
                                </div>
                            </TableCell>
                        </>
                    )}
                    <TableCell className="align-top text-left">
                        <div className="flex gap-2 justify-start">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => setEditingCase({ ...c })}
                            >
                                <Edit size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteCase(c.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                <Trash2 size={16} />
                            </Button>
                        </div>
                    </TableCell>
                </TableRow>
                                            ))}
            </TableBody>
        </Table>
                                </div >

    {/* Mobile Card View */ }
    < div className = "md:hidden space-y-4 p-4 bg-gray-50" >
    {
        filteredHistory.map((c) => (
            <div key={c.id} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4 ${selectedHistoryIds.includes(c.id) ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                        <Checkbox
                            checked={selectedHistoryIds.includes(c.id)}
                            onCheckedChange={() => toggleHistorySelection(c.id)}
                            className="mt-1"
                        />
                        <div>
                            <h4 className="font-bold text-gray-900">{c.customers?.full_name}</h4>
                            {c.transactions && (
                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-100 bg-blue-50 mt-1">
                                    معاملة #{c.transactions.sequence_number}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingCase({ ...c })}>
                                <Edit className="mr-2 h-4 w-4" />
                                تعديل
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteCase(c.id)} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                حذف
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">الخصم:</span>
                        <span className="text-sm text-gray-900">{c.opponent}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">{c.case_number}</Badge>
                        {c.automated_number && <Badge variant="outline" className="text-xs">{c.automated_number}</Badge>}
                    </div>
                    <div className="text-xs text-gray-500">
                        <span className="font-semibold">الجهة:</span> {c.entity}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-lg">
                    <div>
                        <span className="text-gray-500 text-xs block">تاريخ الجلسة</span>
                        <span className="font-medium">{c.session_date}</span>
                    </div>
                    <div>
                        <span className="text-gray-500 text-xs block">القرار</span>
                        <span className="font-medium text-blue-700">{c.session_decision}</span>
                    </div>
                </div>

                {showCustomerStats && (
                    <div className="border-t pt-3 mt-3 space-y-2">
                        <h5 className="text-xs font-bold text-gray-500 mb-2">إحصائيات العميل</h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">المعاملات:</span>
                                <span className="font-medium">{c.transactions_count}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">المديونية:</span>
                                <span className="font-bold text-red-600">{c.total_debt}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">المدفوع:</span>
                                <span className="font-bold text-green-600">{c.total_paid}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">آخر دفعة:</span>
                                <span>{c.last_payment_amount ? `${c.last_payment_amount}` : '-'}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ))
    }
                                </div >
                            </div >
                        ) : (
    <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
        <Search className="mx-auto text-gray-300 mb-4" size={48} />
        <h3 className="text-xl font-bold text-gray-900 mb-2">لا توجد نتائج</h3>
        <p className="text-gray-500">لم يتم العثور على أي قضايا تطابق بحثك.</p>
    </div>
)}
                    </div >
                </TabsContent >
    <TabsContent value="legal-fees">
        <LegalFeeManager />
    </TabsContent>
            </Tabs >

    {/* Edit/Add Case Dialog */ }
    < Dialog open = {!!editingCase} onOpenChange = {(open) => {
    if (!open) {
        setEditingCase(null);
        setIsAddingCase(false);
    }
}}>
    <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
            <DialogTitle className="text-right">
                {isAddingCase ? "إضافة قضية جديدة" : "تعديل بيانات القضية"}
            </DialogTitle>
            <DialogDescription className="text-right">
                أدخل تفاصيل القضية القانونية أدناه.
            </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
            {isAddingCase && (
                <div className="col-span-2 space-y-2">
                    <Label>العميل</Label>
                    <Select
                        value={editingCase?.customer_id}
                        onValueChange={(val) => setEditingCase({ ...editingCase, customer_id: val })}
                    >
                        <SelectTrigger className="text-right">
                            <SelectValue placeholder="اختر العميل" />
                        </SelectTrigger>
                        <SelectContent>
                            {customers?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.full_name} ({c.sequence_number})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="opponent">الخصم</Label>
                <Input
                    id="opponent"
                    value={editingCase?.opponent || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, opponent: e.target.value })}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="case_number">رقم القضية</Label>
                <Input
                    id="case_number"
                    value={editingCase?.case_number || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, case_number: e.target.value })}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="automated_number">الرقم الآلي</Label>
                <Input
                    id="automated_number"
                    value={editingCase?.automated_number || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, automated_number: e.target.value })}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="entity">الجهة</Label>
                <Input
                    id="entity"
                    value={editingCase?.entity || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, entity: e.target.value })}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="session_date">تاريخ الجلسة</Label>
                <Input
                    id="session_date"
                    value={editingCase?.session_date || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, session_date: e.target.value })}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="next_session_date">الجلسة القادمة</Label>
                <Input
                    id="next_session_date"
                    value={editingCase?.next_session_date || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, next_session_date: e.target.value })}
                />
            </div>
            <div className="col-span-2 space-y-2">
                <Label htmlFor="session_decision">قرار الجلسة</Label>
                <Input
                    id="session_decision"
                    value={editingCase?.session_decision || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, session_decision: e.target.value })}
                />
            </div>
            <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Input
                    id="notes"
                    value={editingCase?.notes || ""}
                    onChange={(e) => setEditingCase({ ...editingCase, notes: e.target.value })}
                />
            </div>
        </div>
        <DialogFooter className="flex gap-2 justify-start">
            <Button onClick={handleEditSave} disabled={editMutation.isPending || addMutation.isPending}>
                {(editMutation.isPending || addMutation.isPending) ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
                {isAddingCase ? "إضافة القضية" : "حفظ التعديلات"}
            </Button>
            <Button variant="outline" onClick={() => {
                setEditingCase(null);
                setIsAddingCase(false);
            }}>إلغاء</Button>
        </DialogFooter>
    </DialogContent>
            </Dialog >
        </div >
    );
};
