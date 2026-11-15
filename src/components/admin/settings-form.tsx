"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveSettingsAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, fieldAria } from "@/components/ui/form";
import { Card } from "@/components/ui/misc";
import { siteConfig } from "@/config/site";
import { moneyToInput, parseMoneyInput } from "@/lib/utils";
import type { StoreSettings } from "@/lib/types";

type AreaRow = { id: string; name: string; fee: string };

export function SettingsForm({ settings, envOwnerEmail }: { settings: StoreSettings; envOwnerEmail: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [areas, setAreas] = useState<AreaRow[]>(settings.deliveryAreas.map((a) => ({ id: a.id, name: a.name, fee: moneyToInput(a.fee) })));
  const [freeFrom, setFreeFrom] = useState(moneyToInput(settings.freeDeliveryThreshold));
  const [lowStock, setLowStock] = useState(String(settings.lowStockThreshold));
  const [ownerEmail, setOwnerEmail] = useState(settings.ownerEmail);
  const [contact, setContact] = useState(settings.contact);
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [ordersEnabled, setOrdersEnabled] = useState(settings.ordersEnabled);

  const currency = siteConfig.currency.label;
  const setContactField = (key: keyof typeof contact) => (event: { target: { value: string } }) =>
    setContact((c) => ({ ...c, [key]: event.target.value }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    const parsedAreas = areas.map((row, index) => {
      const fee = parseMoneyInput(row.fee);
      if (!row.name.trim()) found[`deliveryAreas.${index}.name`] = "Nomini kiriting.";
      if (fee === null) found[`deliveryAreas.${index}.fee`] = "Narxni kiriting (bepul boʻlsa 0).";
      return { id: row.id, name: row.name, fee: fee ?? 0 };
    });
    const free = freeFrom.trim() === "" ? null : parseMoneyInput(freeFrom);
    if (freeFrom.trim() !== "" && free === null) found.freeDeliveryThreshold = "Summani kiriting yoki boʻsh qoldiring.";
    if (!/^\d+$/.test(lowStock.trim())) found.lowStockThreshold = "Butun son kiriting.";
    if (areas.length === 0) found.deliveryAreas = "Kamida bitta yetkazib berish hududini qoʻshing.";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage({ tone: "error", text: "Belgilangan maydonlarni tuzating." });
      return;
    }

    startTransition(async () => {
      const result = await saveSettingsAction({
        deliveryAreas: parsedAreas,
        freeDeliveryThreshold: free,
        lowStockThreshold: Number(lowStock),
        ownerEmail,
        contact,
        announcement,
        ordersEnabled,
      }).catch(() => null);
      if (result?.ok) {
        setMessage({ tone: "success", text: "Sozlamalar saqlandi." });
        router.refresh();
      } else {
        setErrors(result?.fieldErrors ?? {});
        setMessage({ tone: "error", text: result?.error ?? "Sozlamalarni saqlab boʻlmadi. Qayta urinib koʻring." });
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-3xl space-y-6">
      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-sans text-base font-bold">Buyurtmalar</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={ordersEnabled} onChange={(e) => setOrdersEnabled(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span>
            <span className="font-medium">Onlayn buyurtmalarni qabul qilish</span>
            <span className="block text-muted">Buyurtma qabul qilishni vaqtincha toʻxtatish uchun belgini olib tashlang (masalan, dam olish kunlarida). Katalog koʻrinib turadi.</span>
          </span>
        </label>
        <Field
          id="s-owner"
          label="Yangi buyurtma xabarlari yuboriladigan email"
          hint={envOwnerEmail ? "Boʻsh qoldirsangiz, ORDER_NOTIFICATION_EMAIL dagi manzil ishlatiladi." : "Doʻkon egasining email manzili."}
          error={errors.ownerEmail}
        >
          <Input {...fieldAria("s-owner", errors.ownerEmail, true)} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} maxLength={254} />
        </Field>
        <Field id="s-low" label="Kam qoldiq chegarasi" hint="Qoldigʻi shu sondan kam yoki teng boʻlgan mahsulotlar boshqaruv panelida belgilanadi." error={errors.lowStockThreshold} className="max-w-xs">
          <Input {...fieldAria("s-low", errors.lowStockThreshold, true)} inputMode="numeric" value={lowStock} onChange={(e) => setLowStock(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-sans text-base font-bold">Yetkazib berish hududlari va narxlari</h2>
        {errors.deliveryAreas && <p className="text-sm text-danger">{errors.deliveryAreas}</p>}
        {areas.map((row, index) => (
          <div key={row.id} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
            <Field id={`a-${row.id}-name`} label={index === 0 ? "Hudud" : `${index + 1}-hudud`} error={errors[`deliveryAreas.${index}.name`]}>
              <Input {...fieldAria(`a-${row.id}-name`, errors[`deliveryAreas.${index}.name`])} value={row.name} maxLength={80} onChange={(e) => setAreas((rows) => rows.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))} />
            </Field>
            <Field id={`a-${row.id}-fee`} label={`Narxi (${currency})`} error={errors[`deliveryAreas.${index}.fee`]}>
              <Input {...fieldAria(`a-${row.id}-fee`, errors[`deliveryAreas.${index}.fee`])} inputMode="decimal" value={row.fee} onChange={(e) => setAreas((rows) => rows.map((r) => (r.id === row.id ? { ...r, fee: e.target.value } : r)))} />
            </Field>
            <button type="button" onClick={() => setAreas((rows) => rows.filter((r) => r.id !== row.id))} aria-label={`${row.name || "Hudud"} — olib tashlash`} className="mb-0.5 flex size-10 items-center justify-center rounded-full text-danger hover:bg-danger-soft">
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setAreas((rows) => [...rows, { id: crypto.randomUUID().slice(0, 8), name: "", fee: "0" }])}>
          <Plus className="size-4" aria-hidden="true" /> Hudud qoʻshish
        </Button>
        <Field id="s-free" label={`Bepul yetkazib berish chegarasi (${currency})`} optional hint="Mahsulotlar summasi shu miqdordan kam boʻlmasa, yetkazib berish bepul. Har doim haq olish uchun boʻsh qoldiring." error={errors.freeDeliveryThreshold} className="max-w-xs">
          <Input {...fieldAria("s-free", errors.freeDeliveryThreshold, true)} inputMode="decimal" value={freeFrom} onChange={(e) => setFreeFrom(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-sans text-base font-bold">Xaridorlarga koʻrsatiladigan doʻkon maʼlumotlari</h2>
        <Field id="s-announcement" label="Eʼlon satri" optional hint="Doʻkonning eng tepasidagi qisqa matn. Yashirish uchun boʻsh qoldiring." error={errors.announcement}>
          <Input {...fieldAria("s-announcement", errors.announcement, true)} value={announcement} onChange={(e) => setAnnouncement(e.target.value)} maxLength={160} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-phone" label="Telefon" error={errors["contact.phone"]}>
            <Input {...fieldAria("s-phone", errors["contact.phone"])} value={contact.phone} onChange={setContactField("phone")} maxLength={40} />
          </Field>
          <Field id="s-email" label="Email" error={errors["contact.email"]}>
            <Input {...fieldAria("s-email", errors["contact.email"])} value={contact.email} onChange={setContactField("email")} maxLength={120} />
          </Field>
          <Field id="s-address" label="Manzil" error={errors["contact.address"]}>
            <Input {...fieldAria("s-address", errors["contact.address"])} value={contact.address} onChange={setContactField("address")} maxLength={200} />
          </Field>
          <Field id="s-hours" label="Ish vaqti" error={errors["contact.hours"]}>
            <Input {...fieldAria("s-hours", errors["contact.hours"])} value={contact.hours} onChange={setContactField("hours")} maxLength={120} />
          </Field>
          <Field id="s-instagram" label="Instagram havolasi" optional error={errors["contact.instagram"]}>
            <Input {...fieldAria("s-instagram", errors["contact.instagram"])} value={contact.instagram} onChange={setContactField("instagram")} maxLength={200} placeholder="https://instagram.com/…" />
          </Field>
          <Field id="s-telegram" label="Telegram havolasi" optional error={errors["contact.telegram"]}>
            <Input {...fieldAria("s-telegram", errors["contact.telegram"])} value={contact.telegram} onChange={setContactField("telegram")} maxLength={200} placeholder="https://t.me/…" />
          </Field>
        </div>
      </Card>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" size="lg" loading={pending}>
        Sozlamalarni saqlash
      </Button>
    </form>
  );
}
