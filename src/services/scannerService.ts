/**
 * Converts a data URL string to a File object.
 * @param dataurl The data URL string.
 * @param filename The desired filename for the output File.
 * @returns A File object.
 */
function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    // The regex is safe and handles valid data URLs.
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error('Invalid data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

/**
 * Simulates scanning documents from a TWAIN-compatible scanner.
 * In a real-world application, this function would integrate with a JavaScript
 * TWAIN library (e.g., Dynamic Web TWAIN) to communicate with the scanner hardware.
 * @returns A Promise that resolves with an array of scanned File objects.
 */
export const scanDocuments = (): Promise<File[]> => {
    return new Promise((resolve, reject) => {
        // --- In a real application, this is where you would integrate a TWAIN library. ---
        // 1. Check if the scanning service/daemon is installed on the user's machine.
        // 2. Select the scanner source (e.g., Dynamsoft.DWT.SelectSource()).
        // 3. Acquire the image with specified settings (e.g., Dynamsoft.DWT.AcquireImage()).
        // 4. On success, the library provides the image data (e.g., as a base64 string or blob).
        // 5. You would then convert this data into a File object.
        //
        // For this demonstration, we will simulate the entire process.

        console.log("Simulating scanner connection...");

        setTimeout(() => {
            try {
                console.log("Simulating document scan...");

                // Create a dummy canvas to generate a placeholder image for the scanned document.
                const canvas = document.createElement('canvas');
                canvas.width = 800;
                canvas.height = 1100;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error("Could not create canvas context for simulation."));
                }

                // Style the dummy document to make it look realistic.
                ctx.fillStyle = '#FDFDFD';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333';
                ctx.font = 'bold 24px Tajawal, sans-serif';
                ctx.fillText('مستند ممسوح ضوئيًا (محاكاة)', 50, 60);

                ctx.font = '16px Tajawal, sans-serif';
                ctx.fillStyle = '#555';
                ctx.fillText(`تاريخ المسح: ${new Date().toLocaleString('ar-KW')}`, 50, 90);

                ctx.strokeStyle = '#EAEAEA';
                ctx.lineWidth = 1;
                for (let y = 120; y < canvas.height - 50; y += 25) {
                    ctx.beginPath();
                    ctx.moveTo(50, y);
                    ctx.lineTo(750, y);
                    ctx.stroke();
                }

                // Convert the canvas content to a File object.
                const dataUrl = canvas.toDataURL('image/png');
                const timestamp = new Date().getTime();
                const scannedFile = dataURLtoFile(dataUrl, `scanned-document-${timestamp}.png`);

                // Resolve the promise with an array containing the simulated file.
                resolve([scannedFile]);

            } catch (error) {
                reject(error);
            }
        }, 2000); // Simulate a 2-second scan time for realism.
    });
};
