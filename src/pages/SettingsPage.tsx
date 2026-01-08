import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, Key, Database, Globe, Brain, Image, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const SettingsPage = () => {
    const { toast } = useToast();
    const { hasRole, isReadOnly } = useAuth();
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<any>({});
    const [logoUploading, setLogoUploading] = useState(false);

    // Fetch settings
    const { data: fetchedSettings, isLoading } = useQuery({
        queryKey: ["app-settings"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("app_settings")
                .select("*");

            if (error) {
                // If table doesn't exist yet, return empty
                if (error.code === '42P01') return [];
                throw error;
            }
            return data;
        },
    });

    useEffect(() => {
        if (fetchedSettings) {
            const settingsMap: any = {};
            fetchedSettings.forEach((s: any) => {
                settingsMap[s.setting_key] = s.setting_value;
            });
            setSettings(settingsMap);
        }
    }, [fetchedSettings]);

    const saveMutation = useMutation({
        mutationFn: async (newSettings: any) => {
            const updates = Object.entries(newSettings).map(([key, value]) => ({
                setting_key: key,
                setting_value: value as any,
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from("app_settings")
                .upsert(updates, { onConflict: 'setting_key' });

            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "تم حفظ الإعدادات بنجاح" });
            queryClient.invalidateQueries({ queryKey: ["app-settings"] });
        },
        onError: (error: any) => {
            toast({ title: "خطأ في الحفظ", description: error.message, variant: "destructive" });
        }
    });

    const handleSave = () => {
        saveMutation.mutate(settings);
    };

    const handleChange = (key: string, value: string) => {
        setSettings((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLogoUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `logo_${Date.now()}.${fileExt}`;
            const filePath = `public/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            handleChange('app_logo', publicUrl);
            toast({ title: "تم رفع الشعار بنجاح" });
        } catch (error: any) {
            toast({ title: "خطأ في رفع الشعار", description: error.message, variant: "destructive" });
        } finally {
            setLogoUploading(false);
        }
    };

    if (!hasRole('admin')) {
        return <div className="p-8 text-center">غير مصرح لك بالوصول لهذه الصفحة</div>;
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="container mx-auto py-8 space-y-6" dir="rtl">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">إعدادات النظام</h1>
                <Button onClick={handleSave} disabled={saveMutation.isPending || isReadOnly}>
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
                    حفظ التغييرات
                </Button>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="general">عام</TabsTrigger>
                    <TabsTrigger value="integrations">الربط والخدمات</TabsTrigger>
                    <TabsTrigger value="links">روابط خارجية</TabsTrigger>
                    <TabsTrigger value="advanced">متقدم</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>معلومات التطبيق</CardTitle>
                            <CardDescription>الإعدادات العامة للتطبيق</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>اسم التطبيق</Label>
                                <Input
                                    value={settings['app_name'] || ''}
                                    onChange={(e) => handleChange('app_name', e.target.value)}
                                    placeholder="نظام إدارة الأقساط"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>وصف التطبيق</Label>
                                <Input
                                    value={settings['app_description'] || ''}
                                    onChange={(e) => handleChange('app_description', e.target.value)}
                                    placeholder="إدارة شاملة للمبيعات"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>شعار التطبيق</Label>
                                <div className="flex items-center gap-4">
                                    {settings['app_logo'] ? (
                                        <img src={settings['app_logo']} alt="Logo" className="w-16 h-16 rounded-xl border object-contain bg-muted" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl border bg-muted flex items-center justify-center">
                                            <Image className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            disabled={logoUploading || isReadOnly}
                                        />
                                        {logoUploading && <p className="text-xs text-muted-foreground mt-1">جاري الرفع...</p>}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="integrations" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5 text-blue-600" />
                                OneDrive
                            </CardTitle>
                            <CardDescription>إعدادات الربط مع مايكروسوفت ون درايف</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Client ID</Label>
                                <Input
                                    value={settings['onedrive_client_id'] || ''}
                                    onChange={(e) => handleChange('onedrive_client_id', e.target.value)}
                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Redirect URI</Label>
                                <Input
                                    value={settings['onedrive_redirect_uri'] || ''}
                                    onChange={(e) => handleChange('onedrive_redirect_uri', e.target.value)}
                                    placeholder="https://your-app.com/callback"
                                />
                                <p className="text-xs text-muted-foreground">
                                    يجب أن يطابق هذا الرابط ما تم إعداده في Azure Portal.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Globe className="h-5 w-5 text-green-600" />
                                Google Integration
                            </CardTitle>
                            <CardDescription>إعدادات الربط مع خدمات جوجل (Drive, Sheets)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Google Client ID</Label>
                                <Input
                                    value={settings['google_client_id'] || ''}
                                    onChange={(e) => handleChange('google_client_id', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Google API Key</Label>
                                <Input
                                    type="password"
                                    value={settings['google_api_key'] || ''}
                                    onChange={(e) => handleChange('google_api_key', e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Key className="h-5 w-5 text-purple-600" />
                                Tap Payments
                            </CardTitle>
                            <CardDescription>مفاتيح الربط مع بوابة الدفع تاب</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Secret Key (Live)</Label>
                                <Input
                                    type="password"
                                    value={settings['tap_secret_key'] || ''}
                                    onChange={(e) => handleChange('tap_secret_key', e.target.value)}
                                    placeholder="sk_live_..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Publishable Key (Live)</Label>
                                <Input
                                    value={settings['tap_publishable_key'] || ''}
                                    onChange={(e) => handleChange('tap_publishable_key', e.target.value)}
                                    placeholder="pk_live_..."
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="links" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>روابط خارجية مخصصة</CardTitle>
                            <CardDescription>أضف روابط لتطبيقات أو مواقع خارجية لتظهر في القائمة الجانبية</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="space-y-4 p-4 border rounded-lg bg-muted/30">
                                    <h3 className="font-semibold text-sm">الرابط {i}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>اسم الزر (Label)</Label>
                                            <Input
                                                value={settings[`ext_link_${i}_label`] || ''}
                                                onChange={(e) => handleChange(`ext_link_${i}_label`, e.target.value)}
                                                placeholder="مثال: تطبيق المحاسبة"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>الرابط (URL)</Label>
                                            <Input
                                                value={settings[`ext_link_${i}_url`] || ''}
                                                onChange={(e) => handleChange(`ext_link_${i}_url`, e.target.value)}
                                                placeholder="https://example.com"
                                                dir="ltr"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Brain className="h-5 w-5 text-orange-600" />
                                Gemini AI
                            </CardTitle>
                            <CardDescription>إعدادات الذكاء الاصطناعي</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Gemini API Key</Label>
                                <Input
                                    type="password"
                                    value={settings['gemini_api_key'] || ''}
                                    onChange={(e) => handleChange('gemini_api_key', e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default SettingsPage;
