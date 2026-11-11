import { useTranslation } from "react-i18next";

/** "2 yr 3 mo" / "2 года 3 мес." / "2 yil 3 oy" — or null when unknown. */
export function useTenure(months: number | null | undefined): string | null {
  const { t } = useTranslation();
  if (months === null || months === undefined) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0 && rest === 0) return t("time.lessThanMonth");
  return [years > 0 && t("time.tenureYears", { count: years }), rest > 0 && t("time.tenureMonths", { count: rest })]
    .filter(Boolean)
    .join(" ");
}
