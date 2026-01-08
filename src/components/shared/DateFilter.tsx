import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface DateFilterProps {
    onFilterChange: (filter: { year: number | null; month: number | null }) => void;
    className?: string;
}

const DateFilter = ({ onFilterChange, className }: DateFilterProps) => {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState<string>("all");
    const [month, setMonth] = useState<string>("all");

    const years = Array.from({ length: 10 }, (_, i) => currentYear - i + 1); // Next year down to 10 years ago
    const months = [
        { value: "1", label: "يناير" },
        { value: "2", label: "فبراير" },
        { value: "3", label: "مارس" },
        { value: "4", label: "أبريل" },
        { value: "5", label: "مايو" },
        { value: "6", label: "يونيو" },
        { value: "7", label: "يوليو" },
        { value: "8", label: "أغسطس" },
        { value: "9", label: "سبتمبر" },
        { value: "10", label: "أكتوبر" },
        { value: "11", label: "نوفمبر" },
        { value: "12", label: "ديسمبر" },
    ];

    useEffect(() => {
        const y = year === "all" ? null : parseInt(year);
        const m = month === "all" ? null : parseInt(month);
        onFilterChange({ year: y, month: m });
    }, [year, month, onFilterChange]);

    const handleReset = () => {
        setYear("all");
        setMonth("all");
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="السنة" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">كل السنوات</SelectItem>
                    {years.map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                            {y}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={month} onValueChange={setMonth} disabled={year === "all"}>
                <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="الشهر" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">كل الشهور</SelectItem>
                    {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                            {m.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {(year !== "all" || month !== "all") && (
                <Button variant="ghost" size="icon" onClick={handleReset} title="إلغاء الفلتر">
                    <X className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
};

export default DateFilter;
