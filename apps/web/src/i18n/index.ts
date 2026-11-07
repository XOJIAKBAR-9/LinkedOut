import { API_ERROR_CODES, type ApiErrorCode } from "@linkedout/shared";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { HttpError } from "@/lib/api";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uz from "./locales/uz.json";

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "uz", label: "Oʻzbekcha", short: "UZ" },
] as const;
export type Language = (typeof LANGUAGES)[number]["code"];

export const resources = { en: { translation: en }, ru: { translation: ru }, uz: { translation: uz } } as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "lo-lang",
      caches: ["localStorage"],
      // "ru-RU" → "ru", "uz-Latn-UZ" → "uz"
      convertDetectedLanguage: (lng: string) => lng.split("-")[0] ?? lng,
    },
  });

function syncHtmlLang(lng: string) {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
}
syncHtmlLang(i18n.resolvedLanguage ?? "en");
i18n.on("languageChanged", syncHtmlLang);

/** Current language for Intl formatters. */
export const currentLocale = () => i18n.resolvedLanguage ?? "en";

/**
 * Shared Zod schemas use i18n keys as messages (e.g. "validation.emailInvalid").
 * Translate those; pass anything else through unchanged.
 */
export function translateMessage(message: string | undefined): string | undefined {
  if (!message) return message;
  return message.startsWith("validation.") && i18n.exists(message) ? i18n.t(message as "validation.invalid") : message;
}

/** Human-readable, translated text for any error thrown by the API client. */
export function errorText(err: unknown): string {
  if (err instanceof HttpError && (API_ERROR_CODES as readonly string[]).includes(err.code)) {
    return i18n.t(`errors.${err.code as ApiErrorCode}`);
  }
  return i18n.t("errors.generic");
}

export default i18n;
