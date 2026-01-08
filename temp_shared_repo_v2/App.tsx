import React, { useState, useRef, useEffect } from 'react';
import { convertPdfToImages, exportToExcel, exportToExcelSeparateSheets, exportOpponentsToCsv, exportStrictOpponentListCsv } from './services/fileProcessingService';
import { analyzeDocumentImage, getQuickSummary, generateAudioSummary } from './services/geminiService';
import { Analytics } from './components/Analytics';
import { ChatBot } from './components/ChatBot';
import { CaseData, ExtractedDocument, ExtractionStatus, PersonInfo } from './types';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Download, Printer, LayoutGrid, Layers, FileSpreadsheet, Search, X, ChevronDown, Filter, Zap, Volume2, Play, Pause, ZoomIn, ZoomOut, Smartphone, Monitor, Users, Copy, Check, Scale, Gavel, Briefcase, Banknote } from 'lucide-react';

// Helper for Audio Decoding
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

export default function App() {
  const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
  const [extractedData, setExtractedData] = useState<ExtractedDocument | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [progress, setProgress] = useState<string>("");
  const [viewMode, setViewMode] = useState<'dashboard' | 'detailed'>('dashboard');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCaseType, setSelectedCaseType] = useState<string>("all");
  const [selectedOpponent, setSelectedOpponent] = useState<string>("all");
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const [fontSize, setFontSize] = useState<number>(14);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  
  const [quickSummary, setQuickSummary] = useState<string>("");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  
  // Audio playback refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [triggerAction, setTriggerAction] = useState<'pdf' | 'print' | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (triggerAction && viewMode === 'detailed' && printRef.current) {
      const timer = setTimeout(() => {
        if (triggerAction === 'pdf') {
          executePdfGeneration();
        } else if (triggerAction === 'print') {
          window.print();
        }
        setTriggerAction(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [triggerAction, viewMode]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        setStatus(ExtractionStatus.PROCESSING_PDF);
        setExtractedData(null);
        setErrorMsg("");
        setProgress("جاري تحويل ملف PDF إلى صور...");
        
        stopAudio();

        const images = await convertPdfToImages(file);
        let consolidatedCases: CaseData[] = [];
        let personInfo: PersonInfo = { name: '', civilId: '', dateOfReport: '', type: '' };

        setStatus(ExtractionStatus.ANALYZING_AI);
        for (let i = 0; i < images.length; i++) {
            setProgress(`جاري تحليل الصفحة ${i + 1} من ${images.length}...`);
            const result = await analyzeDocumentImage(images[i]);
            if (i === 0 || !personInfo.name) personInfo = result.person;
            if (result.cases) consolidatedCases = [...consolidatedCases, ...result.cases];
        }
        
        const completeData = { person: personInfo, cases: consolidatedCases };
        setExtractedData(completeData);
        setStatus(ExtractionStatus.COMPLETED);
        getQuickSummary(completeData).then(summary => setQuickSummary(summary));
    } catch (err: any) {
      setStatus(ExtractionStatus.ERROR);
      setErrorMsg(err.message || "حدث خطأ غير متوقع.");
    } finally {
        event.target.value = '';
    }
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const handlePlaySummary = async () => {
    if (isPlayingAudio) {
        stopAudio();
        return;
    }

    if (!quickSummary) return;

    try {
        setIsGeneratingAudio(true);
        const base64Audio = await generateAudioSummary(quickSummary);
        
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const ctx = audioContextRef.current;
        const audioData = decodeBase64(base64Audio);
        const audioBuffer = await decodeAudioData(audioData, ctx, 24000);
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsPlayingAudio(false);
        
        audioSourceRef.current = source;
        source.start();
        setIsPlayingAudio(true);
    } catch (e: any) {
        alert("فشل تشغيل الصوت: " + e.message);
    } finally {
        setIsGeneratingAudio(false);
    }
  };

  const handleCopyDecision = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportExcelSummary = () => {
    if (extractedData) {
      exportToExcel(extractedData.person, extractedData.cases);
      setShowExportMenu(false);
    }
  };

  const handleExportExcelDetailed = () => {
    if (extractedData) {
      exportToExcelSeparateSheets(extractedData.person, extractedData.cases);
      setShowExportMenu(false);
    }
  };

  const executePdfGeneration = async () => {
     if (!extractedData || !printRef.current) return;
    setIsGeneratingPdf(true);
    const element = printRef.current;
    const opt = {
      margin: 0,
      filename: `تقرير_القضايا_${extractedData.person.civilId}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: orientation },
      pagebreak: { mode: ['css', 'legacy'] }
    };
    try {
        await window.html2pdf().set(opt).from(element).save();
    } catch (e) {
        alert("فشل إنشاء ملف PDF.");
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const handleRequestPdf = () => { setViewMode('detailed'); setTriggerAction('pdf'); setShowExportMenu(false); };
  const handleRequestPrint = () => { setViewMode('detailed'); setTriggerAction('print'); };

  const getCaseIcon = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes('تجاري')) return <Briefcase className="text-blue-600" size={24} />;
    if (t.includes('شيك') || t.includes('مالي')) return <Banknote className="text-green-600" size={24} />;
    if (t.includes('جناي') || t.includes('جزائي')) return <Gavel className="text-red-600" size={24} />;
    if (t.includes('أسرة') || t.includes('أحوال')) return <Users className="text-purple-600" size={24} />;
    return <Scale className="text-brand-600" size={24} />;
  };

  const filteredCases = extractedData?.cases.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      c.caseNumber?.toLowerCase().includes(term) ||
      c.opponent?.toLowerCase().includes(term) ||
      c.entity?.toLowerCase().includes(term) ||
      c.automatedNumber?.toLowerCase().includes(term)
    );
    const matchesType = selectedCaseType === "all" || c.caseType === selectedCaseType;
    const matchesOpponent = selectedOpponent === "all" || c.opponent === selectedOpponent;
    return matchesSearch && matchesType && matchesOpponent;
  }) || [];

  const uniqueCaseTypes = extractedData ? Array.from(new Set(extractedData.cases.map(c => c.caseType).filter(Boolean))) : [];
  const uniqueOpponents = extractedData ? Array.from(new Set(extractedData.cases.map(c => c.opponent).filter(Boolean))) : [];

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-12">
      <header className="bg-white shadow-sm sticky top-0 z-50 border-b border-brand-100 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-brand-900 rounded-full flex items-center justify-center text-white text-xl">⚖️</div>
             <div>
               <h1 className="text-xl font-bold text-gray-900">نظام تحليل القضايا</h1>
               <p className="text-xs text-gray-500">وزارة العدل - الكويت</p>
             </div>
          </div>
          
          {status === ExtractionStatus.COMPLETED && (
            <div className="flex gap-2 items-center">
                <div className="bg-gray-100 p-1 rounded-lg flex gap-1 hidden md:flex">
                    <button onClick={() => setViewMode('dashboard')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${viewMode === 'dashboard' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}><LayoutGrid size={16} /> لوحة البيانات</button>
                    <button onClick={() => setViewMode('detailed')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${viewMode === 'detailed' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}><Layers size={16} /> عرض تفصيلي</button>
                </div>
               <button onClick={handleRequestPrint} className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium"><Printer size={16} /> طباعة</button>
               <div className="relative">
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg shadow-sm text-sm font-medium">
                    <Download size={16} /> تصدير <ChevronDown size={14} />
                </button>
                {showExportMenu && (
                    <div className="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-100 z-20">
                        <button onClick={handleExportExcelSummary} className="w-full text-right px-4 py-3 hover:bg-gray-50 text-sm flex items-center gap-2 border-b"><FileSpreadsheet size={16} className="text-green-600"/> Excel (ملخص)</button>
                        <button onClick={handleExportExcelDetailed} className="w-full text-right px-4 py-3 hover:bg-gray-50 text-sm flex items-center gap-2 border-b"><Layers size={16} className="text-blue-600"/> Excel (منفصل)</button>
                        <button onClick={handleRequestPdf} className="w-full text-right px-4 py-3 hover:bg-gray-50 text-sm flex items-center gap-2"><FileText size={16} className="text-red-600"/> PDF (تقرير)</button>
                    </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {status === ExtractionStatus.IDLE && (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center max-w-2xl mx-auto">
            <Upload size={48} className="mx-auto mb-6 text-brand-600" />
            <h2 className="text-3xl font-bold mb-4">رفع ملف القضايا (PDF)</h2>
            <p className="text-gray-600 mb-8">ارفع الملف المستخرج من موقع وزارة العدل ليقوم الذكاء الاصطناعي بتحليله.</p>
            <label className="bg-brand-600 text-white px-8 py-4 rounded-xl font-bold cursor-pointer hover:bg-brand-700 transition">
              <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
              اختيار ملف PDF
            </label>
          </div>
        )}

        {(status === ExtractionStatus.PROCESSING_PDF || status === ExtractionStatus.ANALYZING_AI) && (
          <div className="text-center py-20">
            <Loader size={48} className="animate-spin text-brand-600 mx-auto mb-4" />
            <p className="text-xl font-bold">{progress}</p>
          </div>
        )}

        {status === ExtractionStatus.COMPLETED && extractedData && viewMode === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-brand-900 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
                <Zap className="absolute right-[-20px] top-[-20px] opacity-10 w-40 h-40" />
                <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Zap size={20} className="text-yellow-400" /> ملخص ذكي</h3>
                <p className="text-brand-50 text-lg leading-relaxed">{quickSummary || "جاري التلخيص..."}</p>
                <button onClick={handlePlaySummary} className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-bold border border-white/20 transition">
                    {isGeneratingAudio ? <Loader size={16} className="animate-spin" /> : isPlayingAudio ? <Pause size={16} /> : <Play size={16} />}
                    {isPlayingAudio ? "إيقاف" : "استماع"}
                </button>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-4 border-b font-bold">بيانات صاحب العلاقة</div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div><span className="text-xs text-gray-500 block">الاسم</span><span className="font-bold">{extractedData.person.name}</span></div>
                    <div><span className="text-xs text-gray-500 block">الرقم المدني</span><span className="font-mono">{extractedData.person.civilId}</span></div>
                    <div><span className="text-xs text-gray-500 block">الصفة</span><span>{extractedData.person.type}</span></div>
                    <div><span className="text-xs text-gray-500 block">تاريخ التقرير</span><span>{extractedData.person.dateOfReport}</span></div>
                </div>
            </div>

            <Analytics cases={extractedData.cases} />

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex flex-col md:flex-row gap-4">
                    <input type="text" placeholder="بحث..." className="border rounded-lg px-4 py-2 flex-1" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <select className="border rounded-lg px-4 py-2" value={selectedCaseType} onChange={e => setSelectedCaseType(e.target.value)}>
                        <option value="all">كل الأنواع</option>
                        {uniqueCaseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="bg-gray-100 text-xs text-gray-600 border-b">
                                <th className="p-4">الرقم الآلي</th>
                                <th className="p-4">الجهة</th>
                                <th className="p-4">النوع</th>
                                <th className="p-4">القضية</th>
                                <th className="p-4">الخصم</th>
                                <th className="p-4">القرار</th>
                                <th className="p-4">التالي</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                            {filteredCases.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="p-4 font-mono text-xs">{item.automatedNumber}</td>
                                    <td className="p-4">{item.entity}</td>
                                    <td className="p-4"><span className="flex items-center gap-2">{getCaseIcon(item.caseType)} {item.caseType}</span></td>
                                    <td className="p-4 font-bold">{item.caseNumber}</td>
                                    <td className="p-4">{item.opponent}</td>
                                    <td className="p-4 text-xs max-w-[200px] truncate">{item.sessionDecision}</td>
                                    <td className="p-4 text-brand-600 font-bold">{item.nextSessionDate}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <ChatBot context={extractedData} />
          </div>
        )}

        {status === ExtractionStatus.COMPLETED && extractedData && viewMode === 'detailed' && (
            <div id="print-container-wrapper" className="space-y-8">
                {filteredCases.map((item, idx) => (
                    <div key={idx} className={`${orientation === 'landscape' ? 'a4-landscape-sheet' : 'a4-portrait-sheet'} shadow-md border rounded-lg bg-white p-10 flex flex-col relative`}>
                        <div className="flex justify-between border-b-4 border-gray-900 pb-4 mb-8">
                            <div className="flex items-center gap-4">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Emblem_of_Kuwait.svg/1200px-Emblem_of_Kuwait.svg.png" className="w-16 h-16" alt="Kuwait Emblem" />
                                <div><h1 className="text-xl font-bold">دولة الكويت</h1><h2 className="text-lg">وزارة العدل</h2></div>
                            </div>
                            <div className="text-left font-bold text-3xl">#{item.sequenceNumber || idx + 1}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-8 text-lg">
                            <div className="border-b pb-2"><span className="text-sm text-gray-500 block">صاحب العلاقة</span><span className="font-bold">{extractedData.person.name}</span></div>
                            <div className="border-b pb-2"><span className="text-sm text-gray-500 block">الرقم الآلي</span><span className="font-mono font-bold">{item.automatedNumber}</span></div>
                            <div className="border-b pb-2"><span className="text-sm text-gray-500 block">رقم القضية</span><span className="font-bold text-2xl text-brand-700">{item.caseNumber}</span></div>
                            <div className="border-b pb-2"><span className="text-sm text-gray-500 block">نوع القضية</span><span className="font-bold flex items-center gap-2">{getCaseIcon(item.caseType)} {item.caseType}</span></div>
                            <div className="border-b pb-2"><span className="text-sm text-gray-500 block">الجهة</span><span className="font-bold">{item.entity}</span></div>
                            <div className="border-b pb-2"><span className="text-sm text-gray-500 block">الخصم</span><span className="font-bold">{item.opponent}</span></div>
                            <div className="border-b pb-2"><span className="text-sm text-gray-500 block">تاريخ الجلسة</span><span>{item.sessionDate}</span></div>
                            <div className="border-b pb-2"><span className="text-sm text-gray-500 block">الجلسة القادمة</span><span className="font-bold text-brand-600">{item.nextSessionDate}</span></div>
                            <div className="col-span-2 bg-gray-50 p-6 rounded-lg border-r-4 border-brand-600">
                                <span className="text-xs font-bold text-gray-500 block mb-2">قرار الجلسة</span>
                                <p className="text-xl font-bold leading-relaxed">{item.sessionDecision}</p>
                            </div>
                        </div>
                        <div className="mt-auto pt-8 border-t text-[10px] text-gray-400 flex justify-between uppercase">
                            <span>تم الاستخراج آلياً بواسطة نظام تحليل القضايا الذكي</span>
                            <span>{new Date().toLocaleDateString('ar-KW')}</span>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>
    </div>
  );
}