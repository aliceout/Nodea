import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <h1 className="text-2xl font-bold text-slate-900">
        {t("auth.notFound.title")}
      </h1>
      <p className="mt-2 text-sm text-slate-600 text-center">
        {t("auth.notFound.description")}
      </p>
    </div>
  );
}
