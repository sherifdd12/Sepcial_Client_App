import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ScanDocumentButtonProps {
  transactionId?: string;
  customerId?: string;
  paymentId?: string;
  onUploadSuccess?: () => void;
}

const ScanDocumentButton: React.FC<ScanDocumentButtonProps> = ({ transactionId, customerId, paymentId, onUploadSuccess }) => {
  const [scanning, setScanning] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const startScan = async () => {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      toast({ title: "خطأ في الكاميرا", description: "تعذر الوصول إلى الكاميرا.", variant: "destructive" });
      setScanning(false);
    }
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, 400, 300);

    // Stop camera
    if (videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
    setScanning(false);
    setIsUploading(true);

    canvasRef.current.toBlob(async (blob) => {
      if (!blob) {
        setIsUploading(false);
        return;
      }

      const file = new File([blob], `scan_${Date.now()}.png`, { type: "image/png" });
      const accessToken = localStorage.getItem('onedrive_access_token');

      try {
        if (accessToken) {
          // --- OneDrive Upload ---
          const folderPath = `/transactions/${transactionId || 'general'}/scans`;
          const mod = await import('@/lib/onedriveUpload');
          const { webUrl, name, size, filePath } = await mod.uploadToOneDrive({ accessToken, file, folderPath });

          const { error: dbError } = await supabase.from("document_attachments").insert({
            transaction_id: transactionId || null,
            customer_id: customerId || null,
            payment_id: paymentId || null,
            file_name: name,
            file_path: filePath,
            file_url: webUrl,
            file_type: "image/png",
            file_size: size,
            description: "مستند ممسوح ضوئياً",
            bucket_name: 'onedrive'
          });

          if (dbError) throw dbError;
        } else {
          // --- Supabase Storage Upload ---
          const bucketName = 'documents';
          const fileName = `scan_${Date.now()}.png`;
          const filePath = `${customerId || 'general'}/scans/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: dbError } = await supabase.from("document_attachments").insert({
            transaction_id: transactionId || null,
            customer_id: customerId || null,
            payment_id: paymentId || null,
            file_name: file.name,
            file_path: filePath,
            file_type: "image/png",
            file_size: file.size,
            description: "مستند ممسوح ضوئياً",
            bucket_name: bucketName
          });

          if (dbError) throw dbError;
        }

        toast({ title: "تم رفع المستند الممسوح بنجاح" });
        onUploadSuccess?.();
      } catch (error: any) {
        toast({ title: "خطأ في الرفع", description: error.message, variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    }, "image/png");
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={startScan} disabled={scanning || isUploading} variant="outline">
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
        {isUploading ? "جاري الرفع..." : "مسح مستند"}
      </Button>
      {scanning && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <video ref={videoRef} width={400} height={300} autoPlay className="rounded border shadow-sm" />
          <canvas ref={canvasRef} width={400} height={300} style={{ display: "none" }} />
          <div className="flex gap-2">
            <Button onClick={captureImage} variant="default">التقاط ورفع</Button>
            <Button onClick={() => {
              if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
              }
              setScanning(false);
            }} variant="ghost">إلغاء</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanDocumentButton;
