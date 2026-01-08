import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { handleDatabaseError } from "@/lib/errorHandling";
import { Upload, File, Trash2, Download, Image as ImageIcon, Loader2, Eye, RefreshCw, Cloud, HardDrive } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import ScanDocumentButton from "./ScanDocumentButton";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AttachmentManagerProps {
  customerId?: string;
  transactionId?: string;
  paymentId?: string;
  expenseId?: string;
  employeeId?: string;
  title?: string;
}

const AttachmentManager = ({ customerId, transactionId, paymentId, expenseId, employeeId, title = "المرفقات" }: AttachmentManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isOneDriveConnected, setIsOneDriveConnected] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [storageType, setStorageType] = useState<'system' | 'onedrive'>('system');

  // Check for OneDrive token on component mount
  useEffect(() => {
    const token = localStorage.getItem('onedrive_access_token');
    setIsOneDriveConnected(!!token);
    if (token) {
      // Keep system as default unless user changes it, or maybe default to system for now.
    }
  }, []);

  const { data: attachments, isLoading, refetch } = useQuery({
    queryKey: ["attachments", customerId, transactionId, paymentId, expenseId, employeeId],
    queryFn: async () => {
      let query;
      if (expenseId) {
        query = supabase.from("expense_attachments").select("*").eq("expense_id", expenseId);
      } else if (employeeId) {
        query = supabase.from("employee_attachments").select("*").eq("employee_id", employeeId);
      } else {
        query = supabase.from("document_attachments").select("*");
        if (customerId) query = query.eq("customer_id", customerId);
        if (transactionId) query = query.eq("transaction_id", transactionId);
        if (paymentId) query = query.eq("payment_id", paymentId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!(customerId || transactionId || paymentId || expenseId || employeeId),
  });

  const getFileUrl = (attachment: any) => {
    if (attachment.file_url) return attachment.file_url;
    if (attachment.file_path) {
      const bucket = (attachment as any).bucket_name || 'documents';
      const { data } = supabase.storage.from(bucket).getPublicUrl(attachment.file_path);

      // Fallback for legacy files or incorrect paths
      if (!attachment.file_path.includes('/') && customerId) {
        const altPath = `${customerId}/${attachment.file_path}`;
        const { data: altData } = supabase.storage.from(bucket).getPublicUrl(altPath);
        return altData.publicUrl;
      }

      return data.publicUrl;
    }
    return null;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      let table = "document_attachments";
      if (expenseId) table = "expense_attachments";
      if (employeeId) table = "employee_attachments";

      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تم حذف المرفق بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["attachments", customerId, transactionId, paymentId, expenseId, employeeId] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ في الحذف", description: handleDatabaseError(error), variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleConnectOneDrive = async () => {
    try {
      const { data: fetchedSettings } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value');

      const settingsMap: any = {};
      fetchedSettings?.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });

      const clientId = settingsMap['onedrive_client_id'] ||
        settingsMap['onedrive_config']?.client_id ||
        import.meta.env.VITE_ONE_DRIVE_CLIENT_ID;

      const redirectUri = settingsMap['onedrive_redirect_uri'] ||
        settingsMap['onedrive_config']?.redirect_uri ||
        import.meta.env.VITE_ONE_DRIVE_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        toast({
          title: "خطأ في الإعدادات",
          description: "لم يتم العثور على إعدادات OneDrive (Client ID or Redirect URI)",
          variant: "destructive"
        });
        return;
      }

      const scope = "Files.ReadWrite.All offline_access User.Read";
      // Use response_type=token for Implicit Flow as per user settings
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&scope=${encodeURIComponent(scope)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;

      window.location.href = authUrl;

    } catch (error) {
      console.error("OneDrive Connect Error:", error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء محاولة الاتصال بـ OneDrive", variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({ title: "الرجاء اختيار ملف أولاً", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const accessToken = localStorage.getItem('onedrive_access_token');
      let uploadResult: any = {};
      let bucketName = 'documents';

      if (storageType === 'onedrive' && accessToken) {
        // --- OneDrive Upload ---
        let folderPath = 'customers/unknown';
        if (customerId) {
          const { data: customer } = await supabase.from('customers').select('full_name, sequence_number').eq('id', customerId).single();
          if (customer) {
            const customerName = customer.full_name?.trim() || 'unnamed';
            folderPath = `${customerName}-${customer.sequence_number || '0000'}`;
            if (transactionId) {
              const { data: transaction } = await supabase.from('transactions').select('sequence_number').eq('id', transactionId).single();
              if (transaction) {
                folderPath += `/${transaction.sequence_number || 'general'}`;
              }
            }
          }
        } else if (expenseId) {
          folderPath = 'expenses';
        } else if (employeeId) {
          folderPath = 'employees';
        }

        const { uploadToOneDrive } = await import('@/lib/onedriveUpload');
        const result = await uploadToOneDrive({ accessToken, file: selectedFile, folderPath });

        uploadResult = {
          name: result.name,
          filePath: result.filePath,
          webUrl: result.webUrl,
          size: result.size
        };
        bucketName = 'onedrive';

      } else {
        // --- Supabase Storage Upload (System) ---
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;
        bucketName = 'documents';
        let filePath = `${customerId || 'general'}/${fileName}`;

        if (expenseId) filePath = `expenses/${fileName}`;
        if (employeeId) filePath = `employees/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        uploadResult = {
          name: selectedFile.name,
          filePath: filePath,
          webUrl: null, // Will be generated on fly
          size: selectedFile.size
        };
      }

      // Save metadata to database
      let insertData: any = {
        file_name: uploadResult.name,
        file_path: uploadResult.filePath,
        file_url: uploadResult.webUrl,
        file_type: selectedFile.type,
        created_at: new Date().toISOString()
      };

      let table = "document_attachments";
      if (expenseId) {
        table = "expense_attachments";
        insertData = { ...insertData, expense_id: expenseId };
      } else if (employeeId) {
        table = "employee_attachments";
        insertData = { ...insertData, employee_id: employeeId };
      } else {
        insertData = {
          ...insertData,
          customer_id: customerId,
          transaction_id: transactionId,
          payment_id: paymentId,
          file_size: uploadResult.size,
          description: description || null,
          bucket_name: bucketName
        };
      }

      const { error: dbError } = await supabase.from(table).insert(insertData);

      if (dbError) throw dbError;

      toast({ title: "تم رفع الملف بنجاح" });
      setSelectedFile(null);
      setDescription("");
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      queryClient.invalidateQueries({ queryKey: ["attachments", customerId, transactionId, paymentId, expenseId, employeeId] });

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "فشل رفع الملف", description: handleDatabaseError(error), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (attachment: any) => {
    const type = attachment.file_type || "";
    if (type.startsWith("image/")) {
      const url = getFileUrl(attachment);
      if (url) {
        return (
          <div
            className="h-12 w-12 rounded overflow-hidden border bg-muted flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setPreviewUrl(url);
              setPreviewName(attachment.file_name);
            }}
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
        );
      }
    }
    return <File className="h-6 w-6 text-gray-500" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {title} ({attachments?.length || 0})
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            title="تحديث"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOneDriveConnected && (
          <div className="p-4 border rounded-lg bg-blue-50 text-blue-800 text-center mb-4">
            <p className="mb-2 text-sm">يمكنك رفع الملفات مباشرة إلى النظام، أو ربط حساب OneDrive للتخزين السحابي.</p>
            <Button variant="outline" size="sm" onClick={handleConnectOneDrive} className="w-full border-blue-200">
              ربط حساب OneDrive
            </Button>
          </div>
        )}

        <div className="space-y-3 p-4 border rounded-lg bg-muted/20">

          {isOneDriveConnected && (
            <div className="flex flex-col gap-2 mb-4">
              <Label className="text-sm font-medium">مكان التخزين:</Label>
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-all flex-1",
                    storageType === 'system' ? "bg-primary/10 border-primary" : "bg-background hover:bg-muted"
                  )}
                  onClick={() => setStorageType('system')}
                >
                  <HardDrive className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">النظام (محلي)</span>
                  <input
                    type="radio"
                    name="storageType"
                    value="system"
                    checked={storageType === 'system'}
                    onChange={() => setStorageType('system')}
                    className="mr-auto"
                    aria-label="النظام (محلي)"
                  />
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-all flex-1",
                    storageType === 'onedrive' ? "bg-blue-100 border-blue-500" : "bg-background hover:bg-muted"
                  )}
                  onClick={() => setStorageType('onedrive')}
                >
                  <Cloud className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">OneDrive</span>
                  <input
                    type="radio"
                    name="storageType"
                    value="onedrive"
                    checked={storageType === 'onedrive'}
                    onChange={() => setStorageType('onedrive')}
                    className="mr-auto"
                    aria-label="OneDrive"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-2 items-end">
            <div className="flex-grow w-full">
              <Label htmlFor="file-upload">اختر ملف</Label>
              <Input id="file-upload" type="file" onChange={handleFileSelect} className="w-full" />
            </div>
            <ScanDocumentButton
              customerId={customerId}
              transactionId={transactionId}
              onUploadSuccess={() => queryClient.invalidateQueries({ queryKey: ["attachments", customerId, transactionId, paymentId, expenseId, employeeId] })}
            />
          </div>

          {selectedFile && (
            <p className="text-sm text-muted-foreground mt-1">
              {selectedFile.name} ({formatFileSize(selectedFile.size)})
            </p>
          )}
          <div>
            <Label htmlFor="description">وصف الملف (اختياري)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أضف وصف للملف..."
              rows={2}
            />
          </div>
          <Button onClick={handleUpload} disabled={!selectedFile || uploading} className="w-full">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="mr-2">{uploading ? "جاري الرفع..." : "رفع الملف"}</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">جاري تحميل المرفقات...</div>
        ) : attachments && attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                  {getFileIcon(attachment)}
                  <div className="flex-1 overflow-hidden">
                    <p className="font-medium text-sm truncate" title={attachment.file_name}>{attachment.file_name}</p>
                    {attachment.description && (
                      <p className="text-xs text-muted-foreground truncate">{attachment.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size || 0)}
                      {(attachment as any).bucket_name === 'onedrive' && <span className="mr-2 text-blue-600">(OneDrive)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const url = getFileUrl(attachment);
                      if (url) {
                        if (attachment.file_type?.startsWith('image/')) {
                          setPreviewUrl(url);
                          setPreviewName(attachment.file_name);
                        } else {
                          window.open(url, '_blank');
                        }
                      } else {
                        toast({ title: "فشل الحصول على رابط الملف", variant: "destructive" });
                      }
                    }}
                    title="عرض"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const url = getFileUrl(attachment);
                      if (url) {
                        window.open(url, '_blank');
                      }
                    }}
                    title="تنزيل"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(attachment.id)}
                    title="حذف"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">لا توجد مرفقات</div>
        )}

        <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90 border-none">
            <DialogHeader className="p-4 bg-background/10 text-white absolute top-0 left-0 right-0 z-10 backdrop-blur-sm">
              <DialogTitle className="text-white">{previewName}</DialogTitle>
              <DialogDescription className="text-white/70">
                معاينة المرفق المختار.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center min-h-[50vh] max-h-[85vh]">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={previewName}
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AttachmentManager;