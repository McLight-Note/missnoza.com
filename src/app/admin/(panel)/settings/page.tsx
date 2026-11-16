import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { SettingsForm } from "@/components/admin/settings-form";
import { Notice } from "@/components/ui/form";
import { PageLoading } from "@/components/ui/misc";
import { getSettings } from "@/server/admin/data";
import { requireAdminPage } from "@/server/auth";
import { isEmailConfigured } from "@/server/email";

export const metadata: Metadata = { title: "Sozlamalar" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requireAdminPage();
  const settings = await getSettings();
  const envOwnerEmail = Boolean(process.env.ORDER_NOTIFICATION_EMAIL);
  return (
    <>
      <AdminPageHeader title="Sozlamalar" description="Yetkazib berish, xabarnomalar va xaridorlarga koʻrinadigan maʼlumotlar." />
      {!isEmailConfigured() && (
        <Notice tone="warning" title="Email yuborish sozlanmagan" className="mb-4 max-w-3xl">
          Buyurtma xatlari yuborilishi uchun hostingda RESEND_API_KEY va EMAIL_FROM qiymatlarini kiriting.
        </Notice>
      )}
      {isEmailConfigured() && !settings.ownerEmail && !envOwnerEmail && (
        <Notice tone="warning" title="Xabarnoma manzili koʻrsatilmagan" className="mb-4 max-w-3xl">
          Yangi buyurtma xabarlari keladigan email manzilni kiriting.
        </Notice>
      )}
      <SettingsForm settings={settings} envOwnerEmail={envOwnerEmail} />
    </>
  );
}
