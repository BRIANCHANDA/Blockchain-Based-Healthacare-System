import { formatDistanceToNow, format } from "date-fns";

export function safeFormatDate(dateValue: any, formatStr: string): string {
    if (!dateValue) return "—";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "—";
    return format(d, formatStr);
}

export function safeDistanceToNow(dateValue: any): string {
    if (!dateValue) return "—";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "—";
    return formatDistanceToNow(d, { addSuffix: true });
}