import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Indian financial year label for a given date: April 1 to March 31.
 * e.g. 12 Aug 2026 -> "2026-27";  15 Feb 2027 -> "2026-27"
 * Replaces the hardcoded '2024-25' literals that were scattered around.
 */
export function getFinancialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1; // getMonth: 3 = April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}
