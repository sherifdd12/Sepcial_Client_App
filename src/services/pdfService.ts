import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const convertPdfToImages = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function () {
            const typedarray = new Uint8Array(this.result as ArrayBuffer);

            try {
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
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
                    } as any).promise;

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
        reader.readAsArrayBuffer(file);
    });
};
