"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { signOutAction } from "@/app/actions/auth";
import { updateProfile } from "@/app/actions/shop";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea, fieldAria } from "@/components/ui/form";
import { siteConfig } from "@/config/site";
import type { DeliveryArea } from "@/lib/types";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
          router.replace("/");
          router.refresh();
        })
      }
    >
      Chiqish
    </Button>
  );
}

export function ProfileForm({
  initial,
  areas,
}: {
  initial: { name: string; phone: string; address: string; areaId: string };
  areas: DeliveryArea[];
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setMessage(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateProfile(form).catch(() => null);
      if (result?.ok) {
        setErrors({});
        setMessage({ tone: "success", text: "Maʼlumotlaringiz saqlandi." });
      } else {
        setErrors(result?.fieldErrors ?? {});
        setMessage({ tone: "error", text: result?.error ?? "Maʼlumotlarni saqlab boʻlmadi. Qayta urinib koʻring." });
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="profile-name" label="Ism va familiya" error={errors.name}>
        <Input {...fieldAria("profile-name", errors.name)} autoComplete="name" maxLength={80} value={form.name} onChange={set("name")} />
      </Field>
      <Field id="profile-phone" label="Telefon raqam" hint={`Masalan: ${siteConfig.phone.example}`} error={errors.phone}>
        <Input {...fieldAria("profile-phone", errors.phone, true)} type="tel" inputMode="tel" autoComplete="tel" maxLength={32} value={form.phone} onChange={set("phone")} />
      </Field>
      <Field id="profile-area" label="Yetkazib berish hududi" error={errors.areaId}>
        <Select {...fieldAria("profile-area", errors.areaId)} value={areas.some((a) => a.id === form.areaId) ? form.areaId : ""} onChange={set("areaId")}>
          <option value="">Tanlanmagan</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="profile-address" label="Yetkazib berish manzili" error={errors.address}>
        <Textarea {...fieldAria("profile-address", errors.address)} autoComplete="street-address" maxLength={300} rows={3} value={form.address} onChange={set("address")} />
      </Field>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" loading={pending}>
        Saqlash
      </Button>
    </form>
  );
}
