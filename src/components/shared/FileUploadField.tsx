import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, X, FileText, Image as ImageIcon, FileImage, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploaded_at: string;
  size: number;
}

interface FileUploadFieldProps {
  label?: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  maxSizeInMB?: number;
  acceptedTypes?: string[];
}

const FileUploadField = ({
  label = "المرفقات",
  attachments,
  onAttachmentsChange,
  maxFiles = 10,
  maxSizeInMB = 5,
  acceptedTypes = ["image/*", "application/pdf", ".doc", ".docx"]
}: FileUploadFieldProps) => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);

    if (attachments.length + fileArray.length > maxFiles) {
      toast({
        title: "خطأ",
        description: `لا يمكن رفع أكثر من ${maxFiles} ملفات`,
        variant: "destructive"
      });
      return;
    }

    const newAttachments: Attachment[] = [];

    for (const file of fileArray) {
      if (file.size > maxSizeInMB * 1024 * 1024) {
        toast({
          title: "خطأ",
          description: `حجم الملف ${file.name} يتجاوز ${maxSizeInMB} ميجابايت`,
          variant: "destructive"
        });
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        newAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          url: base64,
          uploaded_at: new Date().toISOString(),
          size: file.size
        });
      } catch (error) {
        toast({
          title: "خطأ",
          description: `فشل رفع الملف ${file.name}`,
          variant: "destructive"
        });
      }
    }

    onAttachmentsChange([...attachments, ...newAttachments]);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (type === 'application/pdf') return <FileImage className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const viewAttachment = (attachment: Attachment) => {
    if (attachment.type.startsWith('image/') || attachment.type === 'application/pdf') {
      window.open(attachment.url, '_blank');
    } else {
      const link = document.createElement('a');
      link.href = attachment.url;
      link.download = attachment.name;
      link.click();
    }
  };

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">{label}</label>

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          اسحب الملفات هنا أو انقر للاختيار
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          الحد الأقصى: {maxFiles} ملفات، {maxSizeInMB} ميجابايت لكل ملف
        </p>
        <input
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="file-upload-input"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          اختيار الملفات
        </Button>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">الملفات المرفقة ({attachments.length})</p>
          <div className="grid gap-2">
            {attachments.map((attachment) => (
              <Card key={attachment.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(attachment.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {formatFileSize(attachment.size)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(attachment.uploaded_at).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => viewAttachment(attachment)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(attachment.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadField;
