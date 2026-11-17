"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useState, useTransition, type FormEvent } from "react";
import { addOrderNoteAction, resendOrderEmailsAction, resendTelegramAction, updateOrderStatusAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Notice, Select, Textarea } from "@/components/ui/form";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type ActionResult, type OrderStatus } from "@/lib/types";

type Message = { tone: "success" | "error"; text: string } | null;

function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  // Page state is kept while hidden; do not show an old result on return.
  useLayoutEffect(() => {
    return () => setMessage(null);
  }, []);
  const run = (action: () => Promise<ActionResult<unknown>>, success: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action().catch(() => null);
      if (result?.ok) {
        setMessage({ tone: "success", text: success });
        after?.();
        router.refresh();
      } else {
        setMessage({ tone: "error", text: result?.error ?? "Server bilan bogʻlanib boʻlmadi. Qayta urinib koʻring." });
      }
    });
  };
  return { pending, message, run };
}

export function OrderStatusForm({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [value, setValue] = useState<OrderStatus>(status);
  const { pending, message, run } = useAdminAction();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (value === status) return;
    if (value === "cancelled" && !window.confirm("Buyurtma bekor qilinsinmi? Mahsulotlar omborga qaytariladi.")) return;
    run(() => updateOrderStatusAction(orderId, value), `Holat oʻzgartirildi: ${ORDER_STATUS_LABELS[value]}.`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="order-status" className="block text-sm font-medium">
        Buyurtma holati
      </label>
      <div className="flex flex-wrap gap-2">
        <Select id="order-status" value={value} onChange={(e) => setValue(e.target.value as OrderStatus)} className="w-auto flex-1">
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Button type="submit" loading={pending} disabled={value === status}>
          Yangilash
        </Button>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </form>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const [text, setText] = useState("");
  const { pending, message, run } = useAdminAction();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    run(() => addOrderNoteAction(orderId, text), "Izoh qoʻshildi.", () => setText(""));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="order-note" className="block text-sm font-medium">
        Ichki izoh qoʻshish
      </label>
      <Textarea
        id="order-note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Izohlarni faqat doʻkon xodimlari koʻradi."
      />
      <Button type="submit" variant="secondary" loading={pending} disabled={!text.trim()}>
        Izoh qoʻshish
      </Button>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </form>
  );
}

export function ResendEmailButton({ orderId }: { orderId: string }) {
  const { pending, message, run } = useAdminAction();
  return (
    <div className="space-y-2">
      <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => resendOrderEmailsAction(orderId), "Xat yuborildi.")}>
        Xabarnomani qayta yuborish
      </Button>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  );
}

export function ResendTelegramButton({ orderId }: { orderId: string }) {
  const { pending, message, run } = useAdminAction();
  return (
    <div className="space-y-2">
      <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => resendTelegramAction(orderId), "Telegramga yuborildi.")}>
        Telegramga qayta yuborish
      </Button>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  );
}
