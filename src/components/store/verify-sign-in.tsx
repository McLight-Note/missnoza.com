"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createSession } from "@/app/actions/auth";
import { EMAIL_STORAGE_KEY } from "@/components/store/sign-in-form";
import { Button, Spinner, buttonClass } from "@/components/ui/button";
import { Field, Input, Notice, fieldAria } from "@/components/ui/form";
import { getClientAuth, isFirebaseClientConfigured } from "@/lib/firebase-client";
import { safeNextPath } from "@/lib/utils";

type Phase = { name: "working" } | { name: "need-email" } | { name: "error"; message: string };

function describe(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code.includes("invalid-action-code") || code.includes("expired-action-code")) {
    return "Bu kirish havolasining muddati tugagan yoki u allaqachon ishlatilgan. Yangisini soʻrang.";
  }
  if (code.includes("invalid-email")) return "Bu email havola yuborilgan manzilga mos kelmaydi.";
  if (code.includes("user-disabled")) return "Bu hisob bloklangan. Doʻkon bilan bogʻlaning.";
  if (code.includes("network")) return "Tarmoqda muammo. Internet aloqasini tekshirib, qayta urinib koʻring.";
  return "Tizimga kirib boʻlmadi. Yangi havola soʻrang.";
}

/**
 * Landing page for the emailed link. Firebase verifies the one-time code,
 * then the server swaps the resulting ID token for an httpOnly session cookie.
 */
export function VerifySignIn() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const [phase, setPhase] = useState<Phase>({ name: "working" });
  const [email, setEmail] = useState("");
  const started = useRef(false);

  const complete = async (address: string) => {
    setPhase({ name: "working" });
    try {
      const { isSignInWithEmailLink, signInWithEmailLink, signOut } = await import("firebase/auth");
      const auth = await getClientAuth();
      const href = window.location.href;
      if (!isSignInWithEmailLink(auth, href)) {
        setPhase({ name: "error", message: "Bu sahifa faqat xatdagi kirish havolasi orqali ishlaydi." });
        return;
      }
      const credential = await signInWithEmailLink(auth, address, href);
      let result = await createSession(await credential.user.getIdToken());
      if (result.ok && result.data.refreshToken) {
        // Admin rights were just granted: fetch a token that carries them.
        result = await createSession(await credential.user.getIdToken(true));
      }
      await signOut(auth).catch(() => {});
      try {
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
      } catch {}
      if (!result.ok) {
        setPhase({ name: "error", message: result.error });
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (error) {
      setPhase({ name: "error", message: describe(error) });
    }
  };

  useEffect(() => {
    if (started.current || !isFirebaseClientConfigured) return;
    started.current = true;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    } catch {}
    // Opened on a different device or browser: ask for the email again,
    // which stops someone else's intercepted link from being enough.
    const run = saved ? () => complete(saved) : () => Promise.resolve(setPhase({ name: "need-email" }));
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isFirebaseClientConfigured) {
    return <Notice tone="warning" title="Kirish hozircha ishlamaydi" />;
  }

  if (phase.name === "working") {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-8 text-center">
        <Spinner className="size-6 text-brand-600" />
        <p className="font-medium">Tizimga kirilmoqda…</p>
      </div>
    );
  }

  if (phase.name === "need-email") {
    const onSubmit = (event: FormEvent) => {
      event.preventDefault();
      if (email.trim()) void complete(email.trim());
    };
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="verify-email" label="Emailingizni tasdiqlang" hint="Shu havola yuborilgan email manzilni kiriting.">
          <Input
            {...fieldAria("verify-email", undefined, true)}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          Kirishni yakunlash
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <Notice tone="error" title="Kirish yakunlanmadi">
        {phase.message}
      </Notice>
      <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className={buttonClass({ size: "lg" }, "w-full")}>
        Yangi havola soʻrash
      </Link>
    </div>
  );
}
