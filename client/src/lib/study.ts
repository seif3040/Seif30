import { toast } from "sonner";

export const money = new Intl.NumberFormat("ar-EG");

const _rawArabicDate = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const _rawShortDate = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" });

export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      const d = new Date(num);
      if (!isNaN(d.getTime())) return d;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const d = new Date(`${trimmed}T00:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function formatShortDate(value: unknown, fallback = "—"): string {
  const d = parseDate(value);
  if (!d) return fallback;
  try {
    return _rawShortDate.format(d);
  } catch {
    return fallback;
  }
}

export function formatArabicDate(value: unknown, fallback = "—"): string {
  const d = parseDate(value);
  if (!d) return fallback;
  try {
    return _rawArabicDate.format(d);
  } catch {
    return fallback;
  }
}

export const arabicDate = {
  format(value: unknown): string {
    return formatArabicDate(value);
  },
};

export const shortDate = {
  format(value: unknown): string {
    return formatShortDate(value);
  },
};

export function minutesLabel(minutes: number) { return `${money.format(Math.round(minutes / 60 * 10) / 10)} ساعة`; }
export function inputDate(value?: Date | string | number | null) {
  const d = parseDate(value);
  if (!d) return "";
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
export function errorText(error: unknown) { return error instanceof Error ? error.message : "تعذر إتمام العملية. حاول مرة أخرى."; }
export function completionToast(result: any, defaultAmount?: number) { if (result?.awarded) toast.success(`أحسنت! ربحت +${money.format(defaultAmount ?? 0)} Coins`); else if (result?.alreadyCompleted) toast.message("تم تسجيل هذا الإنجاز مسبقًا."); (result?.unlocks ?? []).forEach((unlock: any) => toast.success(`🏆 تم فتح إنجاز: ${unlock.title}`)); }
export function uuid() { return crypto.randomUUID(); }
export const rarityNames: Record<string, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", mythic: "Mythic" };
export const rarityColor: Record<string, string> = { common: "bg-slate-100 text-slate-700", uncommon: "bg-emerald-100 text-emerald-800", rare: "bg-sky-100 text-sky-800", epic: "bg-violet-100 text-violet-800", legendary: "bg-amber-100 text-amber-900", mythic: "bg-rose-100 text-rose-900" };
