import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { formatKWD } from "@/lib/utils-arabic";

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  isCurrency?: boolean;
}

const StatsCard = ({ title, value, icon: Icon, variant = 'default', isCurrency = false }: StatsCardProps) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-success/20 bg-success/5';
      case 'warning':
        return 'border-warning/20 bg-warning/5';
      case 'danger':
        return 'border-danger/20 bg-danger/5';
      default:
        return 'border-border bg-card';
    }
  };

  const getIconStyles = () => {
    switch (variant) {
      case 'success':
        return 'text-success bg-success/10';
      case 'warning':
        return 'text-warning bg-warning/10';
      case 'danger':
        return 'text-danger bg-danger/10';
      default:
        return 'text-primary bg-primary/10';
    }
  };

  return (
    <Card className={`shadow-card ${getVariantStyles()}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground truncate" title={title}>
          {title}
        </CardTitle>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getIconStyles()}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-xl sm:text-2xl font-bold text-foreground break-all">
          {value === undefined || value === null ? '-' :
            isCurrency ? formatKWD(value) : value.toLocaleString('ar-KW')}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;