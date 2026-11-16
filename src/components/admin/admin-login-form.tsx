"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useState, useTransition, type FormEvent } from "react";
import { adminPasswordSignIn } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, fieldAria } from "@/components/ui/form";

/** Email + password form for the shop owner. Checked entirely on the server. */
export function AdminLoginForm({ afterLogin }: { afterLogin: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Next.js keeps a hidden page's state: never leave the password (or an old
  // error) behind once this page is left.
  useLayoutEffect(() => {
    return () => {
      setPassword("");
      setError(null);
    };
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await adminPasswordSignIn(email, password).catch(() => null);
      setPassword("");
      if (result?.ok) {
        router.replace(afterLogin);
        router.refresh();
        return;
      }
      setError(result?.error ?? "Server bilan bogʻlanib boʻlmadi. Qayta urinib koʻring.");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Notice tone="error" title={error} />}
      <Field id="admin-email" label="Email">
        <Input
          {...fieldAria("admin-email")}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field id="admin-password" label="Parol">
        <Input
          {...fieldAria("admin-password")}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending || !email.trim() || !password}>
        {pending ? "Tekshirilmoqda…" : "Kirish"}
      </Button>
    </form>
  );
}
