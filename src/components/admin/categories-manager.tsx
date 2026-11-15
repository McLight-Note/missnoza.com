"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { deleteCategoryAction, saveCategoryAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Notice } from "@/components/ui/form";
import { Card } from "@/components/ui/misc";
import type { Category } from "@/lib/types";

type Message = { tone: "success" | "error"; text: string } | null;

function Row({ category, onMessage }: { category: Category; onMessage: (m: Message) => void }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [order, setOrder] = useState(String(category.order));
  const [pending, startTransition] = useTransition();
  const dirty = name !== category.name || order !== String(category.order);

  const save = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveCategoryAction(category.id, { name, order: Number(order) || 0 }).catch(() => null);
      onMessage(result?.ok ? { tone: "success", text: `“${name}” saqlandi.` } : { tone: "error", text: result?.fieldErrors?.name ?? result?.error ?? "Saqlab boʻlmadi." });
      if (result?.ok) router.refresh();
    });
  };
  const remove = () => {
    if (!window.confirm(`“${category.name}” kategoriyasi oʻchirilsinmi?`)) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id).catch(() => null);
      onMessage(result?.ok ? { tone: "success", text: `“${category.name}” oʻchirildi.` } : { tone: "error", text: result?.error ?? "Oʻchirib boʻlmadi." });
      if (result?.ok) router.refresh();
    });
  };

  return (
    <li>
      <form onSubmit={save} className="grid grid-cols-[1fr_5rem] gap-2 p-3 sm:grid-cols-[1fr_6rem_auto_auto] sm:items-center sm:px-5">
        <label>
          <span className="sr-only">Kategoriya nomi</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        </label>
        <label>
          <span className="sr-only">Tartib raqami</span>
          <Input value={order} onChange={(e) => setOrder(e.target.value)} inputMode="numeric" title="Tartib raqami (kichigi birinchi koʻrsatiladi)" />
        </label>
        <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={!dirty}>
          Saqlash
        </Button>
        <Button variant="dangerGhost" size="sm" onClick={remove} disabled={pending} aria-label={`${category.name} — oʻchirish`}>
          <Trash2 className="size-4" aria-hidden="true" /> Oʻchirish
        </Button>
      </form>
    </li>
  );
}

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const nextOrder = categories.reduce((max, c) => Math.max(max, c.order), 0) + 10;
    startTransition(async () => {
      const result = await saveCategoryAction(null, { name, order: nextOrder }).catch(() => null);
      if (result?.ok) {
        setMessage({ tone: "success", text: `“${name.trim()}” qoʻshildi.` });
        setName("");
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result?.fieldErrors?.name ?? result?.error ?? "Kategoriyani qoʻshib boʻlmadi." });
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-4 sm:p-5">
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1">
            <span className="mb-1.5 block text-sm font-medium">Yangi kategoriya</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Masalan: Teri parvarishi" />
          </label>
          <Button type="submit" loading={pending} disabled={!name.trim()}>
            Qoʻshish
          </Button>
        </form>
      </Card>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {categories.length === 0 ? (
        <p className="text-sm text-muted">Hali kategoriya yoʻq. Kategoriyalar xaridorlarga mahsulotlarni saralashda yordam beradi.</p>
      ) : (
        <Card className="overflow-hidden">
          <p className="border-b border-line bg-sand px-3 py-2 text-xs text-muted sm:px-5">Nomi · tartib raqami (kichik raqam birinchi koʻrsatiladi)</p>
          <ul className="divide-y divide-line">
            {categories.map((category) => (
              <Row key={`${category.id}-${category.name}-${category.order}`} category={category} onMessage={setMessage} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
