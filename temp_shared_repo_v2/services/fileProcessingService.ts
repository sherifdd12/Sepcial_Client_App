import { CaseData, PersonInfo } from "../types";

// Convert a File object (PDF) to an array of Base64 images (one per page)
export const convertPdfToImages = async (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    // Check if PDF.js is loaded
    if (!window.pdfjsLib) {
        reject(new Error("مكتبة PDF.js لم يتم تحميلها بشكل صحيح. يرجى تحديث الصفحة."));
        return;
    }

    const reader = new FileReader();
    reader.onload = async function () {
      const typedarray = new Uint8Array(this.result as ArrayBuffer);

      try {
        const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
        const numPages = pdf.numPages;
        const images: string[] = [];

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (!context) throw new Error("Canvas context not found");

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Convert to JPEG base64 (remove prefix for Gemini)
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          const base64Data = base64.split(',')[1];
          images.push(base64Data);
        }
        resolve(images);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("فشل قراءة الملف."));
    reader.readAsArrayBuffer(file);
  });
};

// Export data to Excel using SheetJS (Summary Sheet)
export const exportToExcel = (person: PersonInfo, cases: CaseData[]) => {
  if (!window.XLSX) {
    alert("Excel library not loaded");
    return;
  }

  // Create Header Info Row
  const extractionDate = new Date().toLocaleDateString('ar-KW');
  const headerInfo = [
    { "الاسم": "تاريخ الاستخراج", "الرقم المدني": extractionDate },
    { "الاسم": "الاسم", "الرقم المدني": person.name },
    { "الاسم": "الرقم المدني", "الرقم المدني": person.civilId }
  ];

  // Flatten data for Excel
  const data = cases.map(c => ({
    "الاسم": person.name,
    "الرقم المدني": person.civilId,
    "م": c.sequenceNumber,
    "الرقم الآلي": c.automatedNumber,
    "الجهة": c.entity,
    "النوع": c.caseType,
    "رقم الدائرة": c.circleNumber,
    "رقم القضية": c.caseNumber,
    "الخصم": c.opponent,
    "ت. الجلسة": c.sessionDate,
    "قرار الجلسة": c.sessionDecision,
    "ت. الجلسة القادمة": c.nextSessionDate
  }));

  const combinedData = [...headerInfo, {}, ...data]; // Add empty row between header and data

  const ws = window.XLSX.utils.json_to_sheet(combinedData, { rtl: true, skipHeader: false });
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "ملخص القضايا");
  
  // Generate filename
  const filename = `القضايا_ملخص_${person.civilId}_${new Date().toISOString().slice(0,10)}.xlsx`;
  window.XLSX.writeFile(wb, filename);
};

// Export data to Excel with separate sheets for each case
export const exportToExcelSeparateSheets = (person: PersonInfo, cases: CaseData[]) => {
  if (!window.XLSX) {
    alert("Excel library not loaded");
    return;
  }

  const wb = window.XLSX.utils.book_new();
  const extractionDate = new Date().toLocaleDateString('ar-KW');

  cases.forEach((c, index) => {
    // Create detailed vertical layout for each case
    const sheetData = [
        ["بيانات التقرير"],
        ["تاريخ الاستخراج", extractionDate],
        [""],
        ["بيانات صاحب العلاقة"],
        ["الاسم", person.name],
        ["الرقم المدني", person.civilId],
        ["صفة الشخص", person.type],
        [""], // Empty row
        ["بيانات القضية رقم", c.sequenceNumber || (index + 1).toString()],
        ["الرقم الآلي", c.automatedNumber],
        ["الجهة", c.entity],
        ["النوع", c.caseType],
        ["رقم الدائرة", c.circleNumber],
        ["رقم القضية", c.caseNumber],
        ["الخصم", c.opponent],
        ["ت. الجلسة", c.sessionDate],
        ["قرار الجلسة", c.sessionDecision],
        ["ت. الجلسة القادمة", c.nextSessionDate]
    ];

    const ws = window.XLSX.utils.aoa_to_sheet(sheetData, { rtl: true });
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }];

    // Valid sheet name (max 31 chars, no special chars)
    const sheetName = `قضية_${c.sequenceNumber || index + 1}`;
    
    try {
        window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
    } catch (e) {
        window.XLSX.utils.book_append_sheet(wb, ws, `Sheet_${index + 1}`);
    }
  });
  
  const filename = `قضايا_منفصلة_${person.civilId}_${new Date().toISOString().slice(0,10)}.xlsx`;
  window.XLSX.writeFile(wb, filename);
};

// Export specific columns (Opponent, Case Number) to CSV
export const exportOpponentsToCsv = (cases: CaseData[]) => {
    const BOM = "\uFEFF";
    const header = "رقم القضية,الخصم\n";
    const rows = cases.map(c => {
        const caseNum = c.caseNumber ? c.caseNumber.replace(/"/g, '""') : "";
        const opponent = c.opponent ? c.opponent.replace(/"/g, '""') : "";
        return `"${caseNum}","${opponent}"`;
    }).join("\n");

    const csvContent = BOM + header + rows;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `الخصوم_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Export ONLY Opponent Names and Case Numbers (Strict format)
export const exportStrictOpponentListCsv = (cases: CaseData[]) => {
    const BOM = "\uFEFF";
    const header = "اسم الخصم,رقم القضية\n";
    const rows = cases.map(c => {
        const opponent = c.opponent ? c.opponent.replace(/"/g, '""') : "";
        const caseNum = c.caseNumber ? c.caseNumber.replace(/"/g, '""') : "";
        return `"${opponent}","${caseNum}"`;
    }).join("\n");

    const csvContent = BOM + header + rows;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `قائمة_الخصوم_المختصرة_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};