"use client";
import { useActionState, useState } from "react";
import { createOrderAction } from "@/app/actions/sales";
import type { ActionState } from "@/lib/action-utils";
import { useResetKey } from "@/components/use-reset-key";
import { FormStatus } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";

interface Option { id: string; name: string; sku: string; available: number; salePriceKzt: number | null }

export function OrderForm({ products, defaultCommissionPct }: { products: Option[]; defaultCommissionPct: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createOrderAction, {});
  const resetKey = useResetKey(state);
  const [productId, setProductId] = useState("");
  const p = products.find((x) => x.id === productId);
  const fe = state.fieldErrors ?? {};
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={action} className="grid gap-4 sm:grid-cols-2" key={resetKey}>
          <Field label="Товар *" error={fe.productId} className="sm:col-span-2">
            <Select name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">— выберите товар —</option>
              {products.map((x) => <option key={x.id} value={x.id} disabled={x.available <= 0}>{x.name} ({x.sku}) · доступно {x.available}</option>)}
            </Select>
          </Field>
          <Field label="Количество, шт *" error={fe.quantity} hint={p ? `Доступно: ${p.available} шт` : undefined}>
            <Input name="quantity" type="number" min="1" max={p?.available} step="1" defaultValue="1" required className="tabular" />
          </Field>
          <Field label="Цена за единицу, ₸ *" error={fe.unitPriceKzt}>
            <Input name="unitPriceKzt" type="number" min="0" step="1" required defaultValue={p?.salePriceKzt ?? ""} key={productId} className="tabular" />
          </Field>
          <Field label="Комиссия Kaspi, ₸" error={fe.commissionKzt} hint={`Пусто — рассчитается по ставке товара или ${defaultCommissionPct}%`}>
            <Input name="commissionKzt" type="number" min="0" step="1" className="tabular" />
          </Field>
          <Field label="Доставка за счёт продавца, ₸" error={fe.deliveryKzt}>
            <Input name="deliveryKzt" type="number" min="0" step="1" className="tabular" />
          </Field>
          <Field label="Дата заказа *" error={fe.orderedAt}>
            <Input name="orderedAt" type="date" required defaultValue={today} max={today} />
          </Field>
          <Field label="Статус">
            <Select name="status" defaultValue="COMPLETED">
              <option value="COMPLETED">Выполнен</option>
              <option value="NEW">Новый (ещё не выдан)</option>
            </Select>
          </Field>
          <Field label="Номер заказа Kaspi" error={fe.externalId}>
            <Input name="externalId" maxLength={100} />
          </Field>
          <Field label="Город" error={fe.city}>
            <Input name="city" maxLength={100} defaultValue="Алматы" />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormStatus state={state} />
            <div><Button disabled={pending}>{pending ? "Сохранение…" : "Сохранить заказ"}</Button></div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
