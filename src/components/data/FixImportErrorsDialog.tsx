import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Check, SkipForward, RefreshCw } from "lucide-react";

interface ImportError {
    row: number;
    message: string;
    originalData: any;
}

interface FixImportErrorsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    error: ImportError | undefined;
    totalErrors: number;
    onRetryRow: (row: any) => Promise<boolean>; // Returns true if success
    onSkipRow: () => void;
    tableName: string;
    mappings: { [key: string]: string };
}

export const FixImportErrorsDialog = ({
    isOpen,
    onClose,
    error,
    totalErrors,
    onRetryRow,
    onSkipRow,
    tableName,
    mappings
}: FixImportErrorsDialogProps) => {
    const [currentData, setCurrentData] = useState<any>({});
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryError, setRetryError] = useState<string | null>(null);

    useEffect(() => {
        if (error) {
            setCurrentData({ ...error.originalData });
            setRetryError(null);
        }
    }, [error]);

    const handleInputChange = (key: string, value: string) => {
        setCurrentData((prev: any) => ({
            ...prev,
            [key]: value
        }));
    };

    const handleRetry = async () => {
        setIsRetrying(true);
        setRetryError(null);
        try {
            await onRetryRow(currentData);
            // Parent handles moving to next error by updating the 'error' prop
        } catch (error: any) {
            setRetryError(error.message || "حدث خطأ أثناء المحاولة.");
        } finally {
            setIsRetrying(false);
        }
    };

    const handleSkip = () => {
        onSkipRow();
    };

    if (!error) return null;

    const fields = Object.keys(currentData);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>تصحيح أخطاء الاستيراد</DialogTitle>
                    <DialogDescription>
                        يوجد {totalErrors} أخطاء متبقية. جاري تصحيح الخطأ في الصف {error.row}.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>سبب الخطأ</AlertTitle>
                        <AlertDescription>{error.message}</AlertDescription>
                    </Alert>

                    {retryError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>خطأ في المحاولة</AlertTitle>
                            <AlertDescription>{retryError}</AlertDescription>
                        </Alert>
                    )}

                    <ScrollArea className="flex-1 border rounded-md p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fields.map((field) => {
                                // Find if this field is mapped to something
                                const mappedTo = mappings[field];
                                const label = mappedTo ? `${field} (${mappedTo})` : field;

                                return (
                                    <div key={field} className="space-y-2">
                                        <Label htmlFor={field}>{label}</Label>
                                        <Input
                                            id={field}
                                            value={currentData[field] || ''}
                                            onChange={(e) => handleInputChange(field, e.target.value)}
                                            className={mappedTo ? "border-primary/50 bg-primary/5" : ""}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleSkip}>
                        <SkipForward className="mr-2 h-4 w-4" />
                        تخطي هذا الصف
                    </Button>
                    <Button onClick={handleRetry} disabled={isRetrying}>
                        {isRetrying ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="mr-2 h-4 w-4" />
                        )}
                        حفظ وإعادة المحاولة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
