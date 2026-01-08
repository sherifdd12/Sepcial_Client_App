import { useToast as useOriginalToast } from '@/hooks/use-toast';
import { handleDatabaseError } from '@/lib/errorHandling';

export const useSafeToast = () => {
  const { toast } = useOriginalToast();

  const safeToast = {
    success: (title: string, description?: string) => {
      toast({ title, description });
    },
    error: (error: any, customMessage?: string) => {
      const sanitizedMessage = handleDatabaseError(error, customMessage);
      toast({
        title: 'خطأ',
        description: sanitizedMessage,
        variant: 'destructive',
      });
    },
    info: (title: string, description?: string) => {
      toast({ title, description });
    },
  };

  return safeToast;
};