"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { createSession, requestSignInLink } from "@/app/actions/auth";
import { Button, Spinner } from "@/components/ui/button";
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

function googleMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code.includes("popup-blocked")) return "Brauzer Google oynasini blokladi. Qalqib chiquvchi oynalarga ruxsat bering yoki email orqali kiring.";
  if (code.includes("operation-not-allowed")) return "Bu doʻkonda Google orqali kirish hali yoqilmagan. Email orqali kiring.";
  if (code.includes("unauthorized-domain")) return "Bu sayt manzili uchun kirishga hali ruxsat berilmagan. Doʻkon bilan bogʻlaning.";
  if (code.includes("user-disabled")) return "Bu hisob bloklangan. Doʻkon bilan bogʻlaning.";
  if (code.includes("network")) return "Tarmoqda muammo. Internet aloqasini tekshirib, qayta urinib koʻring.";
  return "Google orqali kirib boʻlmadi. Qayta urinib koʻring yoki email orqali kiring.";
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function SignInForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  // Firebase takes several seconds to notice a closed Google window, so the
  // button stays clickable: a new click simply replaces the earlier attempt.
  const googleAttempt = useRef(0);

  // Load the sign-in code ahead of the click, so the Google window opens
  // straight away and browsers do not treat it as an unwanted pop-up.
  useEffect(() => {
    if (!isFirebaseClientConfigured) return;
    void import("firebase/auth");
    void getClientAuth().catch(() => {});
  }, []);

  /**
   * Google sign-in: Google confirms who the person is, then the server swaps
   * the resulting ID token for the same httpOnly session cookie as email links.
   */
  const signInWithGoogle = async () => {
    const attempt = ++googleAttempt.current;
    const current = () => attempt === googleAttempt.current;
    setGoogleError(null);
    setGooglePending(true);
    try {
      const { GoogleAuthProvider, signInWithPopup, signOut } = await import("firebase/auth");
      const auth = await getClientAuth();
      auth.languageCode = "uz";
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      let result = await createSession(await credential.user.getIdToken());
      if (result.ok && result.data.refreshToken) {
        // Admin rights were just granted: fetch a token that carries them.
        result = await createSession(await credential.user.getIdToken(true));
      }
      await signOut(auth).catch(() => {});
      if (!result.ok) {
        if (current()) setGoogleError(result.error);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
      // Closing the Google window is a choice, not an error.
      const dismissed = code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request");
      if (current() && !dismissed) setGoogleError(googleMessage(err));
    } finally {
      if (current()) setGooglePending(false);
    }
  };

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
    <div className="space-y-5">
      <div className="space-y-3">
        {googleError && <Notice tone="error">{googleError}</Notice>}
        <Button variant="secondary" size="lg" className="w-full" onClick={signInWithGoogle} disabled={pending}>
          {googlePending ? <Spinner /> : <GoogleLogo />}
          Google orqali kirish
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        yoki
        <span className="h-px flex-1 bg-line" />
      </div>
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
    </div>
  );
}
