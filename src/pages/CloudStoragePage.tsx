import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { handleDatabaseError } from "@/lib/errorHandling";
import { Cloud, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CloudStoragePage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [oneDriveConfig, setOneDriveConfig] = useState({
    client_id: "",
    client_secret: "",
    tenant_id: "",
    redirect_uri: "",
  });

  const [googleDriveConfig, setGoogleDriveConfig] = useState({
    client_id: "",
    client_secret: "",
    redirect_uri: "",
  });

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ["cloud-storage-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .in("setting_key", ["onedrive_config", "google_drive_config"]);
      
      if (error) throw error;
      
      const oneDrive = data?.find(s => s.setting_key === "onedrive_config");
      const googleDrive = data?.find(s => s.setting_key === "google_drive_config");
      
      if (oneDrive) setOneDriveConfig(oneDrive.setting_value as any);
      if (googleDrive) setGoogleDriveConfig(googleDrive.setting_value as any);
      
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "setting_key",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تم حفظ الإعدادات بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["cloud-storage-settings"] });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
  toast({ title: "خطأ", description: handleDatabaseError(error), variant: "destructive" });
    },
  });

  const handleSaveOneDrive = () => {
    saveMutation.mutate({ key: "onedrive_config", value: oneDriveConfig });
  };

  const handleSaveGoogleDrive = () => {
    saveMutation.mutate({ key: "google_drive_config", value: googleDriveConfig });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Cloud className="h-8 w-8" />
          التخزين السحابي
        </h1>
        <p className="text-muted-foreground">
          قم بربط OneDrive أو Google Drive لتخزين المرفقات بشكل منظم
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>هيكل التخزين</CardTitle>
          <CardDescription>
            سيتم تنظيم الملفات كالتالي:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm" dir="ltr">
            <div>📁 اسم العميل - كود العميل/</div>
            <div className="mr-6">📁 رقم البيع 000001/</div>
            <div className="mr-12">📄 دفعة_2024-01-15.pdf</div>
            <div className="mr-12">📄 صورة_البطاقة.jpg</div>
            <div className="mr-6">📁 رقم البيع 000002/</div>
            <div className="mr-12">📄 عقد_البيع.pdf</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="onedrive" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="onedrive">OneDrive</TabsTrigger>
          <TabsTrigger value="googledrive">Google Drive</TabsTrigger>
        </TabsList>

        <TabsContent value="onedrive">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات OneDrive</CardTitle>
              <CardDescription>
                قم بإنشاء تطبيق في Azure Portal للحصول على بيانات الاعتماد
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="onedrive-client-id">Client ID</Label>
                <Input
                  id="onedrive-client-id"
                  value={oneDriveConfig.client_id}
                  onChange={(e) =>
                    setOneDriveConfig({ ...oneDriveConfig, client_id: e.target.value })
                  }
                  placeholder="أدخل Client ID من Azure"
                />
              </div>
              <div>
                <Label htmlFor="onedrive-client-secret">Client Secret</Label>
                <Input
                  id="onedrive-client-secret"
                  type="password"
                  value={oneDriveConfig.client_secret}
                  onChange={(e) =>
                    setOneDriveConfig({ ...oneDriveConfig, client_secret: e.target.value })
                  }
                  placeholder="أدخل Client Secret من Azure"
                />
              </div>
              <div>
                <Label htmlFor="onedrive-tenant-id">Tenant ID</Label>
                <Input
                  id="onedrive-tenant-id"
                  value={oneDriveConfig.tenant_id}
                  onChange={(e) =>
                    setOneDriveConfig({ ...oneDriveConfig, tenant_id: e.target.value })
                  }
                  placeholder="أدخل Tenant ID من Azure"
                />
              </div>
              <div>
                <Label htmlFor="onedrive-redirect">Redirect URI</Label>
                <Input
                  id="onedrive-redirect"
                  value={oneDriveConfig.redirect_uri}
                  onChange={(e) =>
                    setOneDriveConfig({ ...oneDriveConfig, redirect_uri: e.target.value })
                  }
                  placeholder="https://yourapp.com/callback"
                />
              </div>
              <Button
                onClick={handleSaveOneDrive}
                disabled={saveMutation.isPending}
                className="w-full"
              >
                <Save className="h-4 w-4 ml-2" />
                حفظ إعدادات OneDrive
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="googledrive">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات Google Drive</CardTitle>
              <CardDescription>
                قم بإنشاء مشروع في Google Cloud Console للحصول على بيانات الاعتماد
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="google-client-id">Client ID</Label>
                <Input
                  id="google-client-id"
                  value={googleDriveConfig.client_id}
                  onChange={(e) =>
                    setGoogleDriveConfig({ ...googleDriveConfig, client_id: e.target.value })
                  }
                  placeholder="أدخل Client ID من Google Console"
                />
              </div>
              <div>
                <Label htmlFor="google-client-secret">Client Secret</Label>
                <Input
                  id="google-client-secret"
                  type="password"
                  value={googleDriveConfig.client_secret}
                  onChange={(e) =>
                    setGoogleDriveConfig({ ...googleDriveConfig, client_secret: e.target.value })
                  }
                  placeholder="أدخل Client Secret من Google Console"
                />
              </div>
              <div>
                <Label htmlFor="google-redirect">Redirect URI</Label>
                <Input
                  id="google-redirect"
                  value={googleDriveConfig.redirect_uri}
                  onChange={(e) =>
                    setGoogleDriveConfig({ ...googleDriveConfig, redirect_uri: e.target.value })
                  }
                  placeholder="https://yourapp.com/callback"
                />
              </div>
              <Button
                onClick={handleSaveGoogleDrive}
                disabled={saveMutation.isPending}
                className="w-full"
              >
                <Save className="h-4 w-4 ml-2" />
                حفظ إعدادات Google Drive
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>ملاحظات مهمة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• يجب إعداد OAuth 2.0 في Azure Portal أو Google Cloud Console</p>
          <p>• تأكد من إضافة Redirect URI الصحيح في إعدادات التطبيق</p>
          <p>• سيتم تخزين الملفات بشكل آمن ومنظم حسب العميل والمعاملة</p>
          <p>• يمكنك الوصول إلى الملفات من أي مكان عبر OneDrive أو Google Drive</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CloudStoragePage;
