import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import i18n from "i18next";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fullName(u: { firstName: string; lastName: string }) {
  return `${u.firstName} ${u.lastName}`;
}

export function initials(u: { firstName: string; lastName: string }) {
  return `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();
}

/**
 * Some browsers (incl. Chromium/Electron builds) ship trimmed ICU data for Uzbek: Intl claims support
 * but prints "-43 min" or "2026 M11". For these locales we format with our own translations instead.
 */
const LOCALES_WITHOUT_RELIABLE_INTL = new Set(["uz"]);

const pageLocale = () => globalThis.document?.documentElement.lang || "en";

const formatters = new Map<string, Intl.RelativeTimeFormat>();
const rtfFor = (locale: string) => {
  let f = formatters.get(locale);
  if (!f) formatters.set(locale, (f = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" })));
  return f;
};

/** Relative time ("2 days ago") in the given locale (defaults to the page's <html lang>, kept in sync by i18n). */
export function timeAgo(iso: string, now = Date.now(), locale = pageLocale()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs >= 604800) return formatDate(iso, locale);

  if (LOCALES_WITHOUT_RELIABLE_INTL.has(locale)) {
    const t = i18n.getFixedT(locale);
    if (abs < 60) return t("time.now");
    if (abs < 3600) return t("time.minutesAgo", { count: Math.round(abs / 60) });
    if (abs < 86400) return t("time.hoursAgo", { count: Math.round(abs / 3600) });
    return t("time.daysAgo", { count: Math.round(abs / 86400) });
  }

  const rtf = rtfFor(locale);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

function monthName(date: Date, locale: string) {
  return i18n.getFixedT(locale)("time.months").split(",")[date.getMonth()] ?? "";
}

/** "Nov 2026" / "нояб. 2026" / "noy 2026" */
export function formatMonthYear(iso: string, locale = pageLocale()) {
  const d = new Date(iso);
  if (LOCALES_WITHOUT_RELIABLE_INTL.has(locale)) return `${monthName(d, locale)} ${d.getFullYear()}`;
  return d.toLocaleDateString(locale, { month: "short", year: "numeric" });
}

/** "7 Nov 2026" style date. */
export function formatDate(iso: string, locale = pageLocale()) {
  const d = new Date(iso);
  if (LOCALES_WITHOUT_RELIABLE_INTL.has(locale)) return `${d.getDate()} ${monthName(d, locale)} ${d.getFullYear()}`;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** Date plus HH:MM (24h for ru/uz, locale default otherwise). */
export function formatDateTime(iso: string, locale = pageLocale()) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(LOCALES_WITHOUT_RELIABLE_INTL.has(locale) ? "en-GB" : locale, { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso, locale)}, ${time}`;
}
