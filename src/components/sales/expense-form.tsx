"use client";
import { useActionState } from "react";
import { addExpenseAction } from "@/app/actions/sales";
import type { ActionState } from "@/lib/action-utils";
import { useResetKey } from "@/components/use-reset-key";
import { EXPENSE_LABEL } from "@/lib/labels";
import { FormStatus } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

export function ExpenseForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addExpenseAction, {});
  const resetKey = useResetKey(state);
  const fe = state.fieldErrors ?? {};
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[160px_150px_150px_1fr_auto] sm:items-end" key={resetKey}>
      <Field label="Категория">
        <Select name="category" defaultValue="ADS">{Object.entries(EXPENSE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
      </Field>
      <Field label="Сумма, ₸" error={fe.amountKzt}><Input name="amountKzt" type="number" min="1" step="1" required className="tabular" /></Field>
      <Field label="Дата" error={fe.date}><Input name="date" type="date" required defaultValue={today} max={today} /></Field>
      <Field label="Комментарий"><Input name="note" maxLength={500} /></Field>
      <Button disabled={pending}>{pending ? "…" : "Добавить"}</Button>
      <div className="sm:col-span-5"><FormStatus state={state} /></div>
    </form>
  );
}
