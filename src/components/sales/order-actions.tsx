"use client";
import { useActionState } from "react";
import { reverseOrderAction } from "@/app/actions/sales";
import type { ActionState } from "@/lib/action-utils";
import { Button } from "@/components/ui/button";

/** Кнопки «Возврат» и «Отмена» с подтверждением — это финансово значимые действия */
export function OrderActions({ orderId, status, label }: { orderId: string; status: string; label: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reverseOrderAction, {});
  if (status === "CANCELLED" || status === "RETURNED") return null;
  const confirmAndSubmit = (kind: "RETURNED" | "CANCELLED") => (e: React.FormEvent<HTMLFormElement>) => {
    const text =
      kind === "RETURNED"
        ? `Оформить полный возврат заказа ${label}? Товар вернётся на склад, выручка будет уменьшена.`
        : `Отменить заказ ${label}? Списанный товар вернётся на склад.`;
    if (!window.confirm(text)) e.preventDefault();
  };
  return (
    <div className="flex items-center justify-end gap-1">
      {status === "COMPLETED" && (
        <form action={action} onSubmit={confirmAndSubmit("RETURNED")}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="action" value="RETURNED" />
          <Button size="sm" variant="ghost" disabled={pending}>Возврат</Button>
        </form>
      )}
      <form action={action} onSubmit={confirmAndSubmit("CANCELLED")}>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="action" value="CANCELLED" />
        <Button size="sm" variant="ghost" className="text-danger" disabled={pending}>Отмена</Button>
      </form>
      {state.error && <span className="text-xs text-danger" title={state.error}>!</span>}
    </div>
  );
}
