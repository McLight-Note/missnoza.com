"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { requestSignInLink } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, fieldAria } from "@/components/ui/form";
import { getClientAuth, isFirebaseClientConfigured } from "@/lib/firebase-client";
import { safeNextPath } from "@/lib/utils";

export const EMAIL_STORAGE_KEY = "missnoza.signin.email";

function firebaseMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code.includes("quota")) return "Bugungi kirish xatlari limiti tugadi. Roʻyxatdan oʻtmasdan ham buyurtma berishingiz mumkin yoki ertaga qayta urinib koʻring.";
  if (code.includes("too-many-requests")) return "Juda koʻp xat soʻraldi. Biroz kutib, qayta urinib koʻring.";
  if (code.includes("invalid-email")) return "Toʻgʻri email manzil kiriting.";
  if (code.includes("operation-not-allowed")) return "Bu doʻkonda email orqali kirish hali yoqilmagan.";
  if (code.includes("unauthorized-continue-uri") || code.includes("unauthorized-domain")) {
    return "Bu sayt manzili uchun kirishga hali ruxsat berilmagan. Doʻkon bilan bogʻlaning.";
  }
  if (code.includes("network")) return "Tarmoqda muammo. Internet aloqasini tekshirib, qayta urinib koʻring.";
  return "Xatni hozir yuborib boʻlmadi. Bir daqiqadan keyin qayta urinib koʻring.";
}

export function SignInForm() {
  const next = safeNextPath(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  // Count the resend cooldown down once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const send = (address: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestSignInLink(address, next);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.data.delivery === "client") {
          // No email provider configured: let Firebase send its built-in email.
          const { sendSignInLinkToEmail } = await import("firebase/auth");
          await sendSignInLinkToEmail(await getClientAuth(), address.trim(), {
            url: `${window.location.origin}/auth/verify?next=${encodeURIComponent(next)}`,
            handleCodeInApp: true,
          });
        }
        try {
          window.localStorage.setItem(EMAIL_STORAGE_KEY, address.trim().toLowerCase());
        } catch {}
        setSentTo(address.trim());
        setCooldown(result.data.cooldownSeconds);
      } catch (err) {
        setError(firebaseMessage(err));
      }
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Toʻgʻri email manzil kiriting.");
      return;
    }
    send(email);
  };

  if (!isFirebaseClientConfigured) {
    return (
      <Notice tone="warning" title="Kirish hozircha ishlamaydi">
        Doʻkon egasi Firebase xizmatini ulashi kerak. Roʻyxatdan oʻtmasdan ham buyurtma berishingiz mumkin.
      </Notice>
    );
  }

  if (sentTo) {
    return (
      <div className="space-y-5 text-center">
        <MailCheck className="mx-auto size-12 text-brand-600" aria-hidden="true" />
        <div role="status">
          <h2 className="text-2xl font-semibold">Pochtangizni tekshiring</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            <strong className="text-ink">{sentTo}</strong> manziliga kirish havolasini yubordik. Kirishni yakunlash uchun uni shu qurilmada oching. Xat bir daqiqa ichida keladi — «Spam» jildini ham tekshiring.
          </p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" onClick={() => send(sentTo)} disabled={cooldown > 0} loading={pending}>
            {cooldown > 0 ? `Qayta yuborish: ${cooldown} s` : "Havolani qayta yuborish"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted underline"
            onClick={() => {
              setSentTo(null);
              setError(null);
            }}
          >
            Boshqa email kiritish
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="signin-email" label="Email manzil" hint="Sizga bir martalik kirish havolasini yuboramiz. Parol kerak emas." error={error ?? undefined}>
        <Input
          {...fieldAria("signin-email", error ?? undefined, true)}
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Kirish havolasini yuborish
      </Button>
    </form>
  );
}
