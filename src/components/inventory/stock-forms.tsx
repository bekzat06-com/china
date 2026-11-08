"use client";
import { useActionState, useState } from "react";
import { receiveStockAction, adjustStockAction } from "@/app/actions/inventory";
import type { ActionState } from "@/lib/action-utils";
import { useResetKey } from "@/components/use-reset-key";
import { FormStatus } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { formatKzt } from "@/lib/utils";

export interface ProductOption {
  id: string;
  name: string;
  sku: string;
  available: number;
  lastBatchCostKzt: number | null;
  landedCostKzt: number | null; // из последнего расчёта калькулятора
}

function todayAlmaty() {
  return new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
}

export function ReceiveForm({ products, initialProductId }: { products: ProductOption[]; initialProductId?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(receiveStockAction, {});
  const resetKey = useResetKey(state);
  const [productId, setProductId] = useState(initialProductId ?? "");
  const p = products.find((x) => x.id === productId);
  const suggested = p?.landedCostKzt ?? p?.lastBatchCostKzt ?? null;
  const fe = state.fieldErrors ?? {};
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={action} className="grid gap-4 sm:grid-cols-2" key={resetKey}>
          <Field label="Товар *" error={fe.productId} className="sm:col-span-2">
            <Select name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">— выберите товар —</option>
              {products.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.sku}) · на складе {x.available}</option>)}
            </Select>
          </Field>
          <Field label="Количество, шт *" error={fe.quantity}>
            <Input name="quantity" type="number" min="1" step="1" required className="tabular" />
          </Field>
          <Field
            label="Себестоимость единицы, ₸ *"
            error={fe.unitCostKzt}
            hint={suggested !== null ? `Подсказка: ${formatKzt(suggested)} (${p?.landedCostKzt != null ? "из калькулятора" : "последняя партия"})` : "Полная себестоимость до склада — из калькулятора"}
          >
            <Input name="unitCostKzt" type="number" min="0" step="0.01" required defaultValue={suggested ?? ""} key={productId} className="tabular" />
          </Field>
          <Field label="Дата прихода *" error={fe.receivedAt}>
            <Input name="receivedAt" type="date" required defaultValue={todayAlmaty()} max={todayAlmaty()} />
          </Field>
          <Field label="Примечание" hint="Например: поставщик, номер карго" error={fe.note}>
            <Input name="note" maxLength={500} />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormStatus state={state} />
            <div><Button disabled={pending}>{pending ? "Сохранение…" : "Оприходовать"}</Button></div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AdjustForm({ products, isOwner }: { products: ProductOption[]; isOwner: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(adjustStockAction, {});
  const resetKey = useResetKey(state);
  const [productId, setProductId] = useState("");
  const p = products.find((x) => x.id === productId);
  const fe = state.fieldErrors ?? {};
  return (
    <Card>
      <CardContent className="pt-5">
        <form action={action} className="grid gap-4 sm:grid-cols-2" key={resetKey}>
          <Field label="Товар *" error={fe.productId} className="sm:col-span-2">
            <Select name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">— выберите товар —</option>
              {products.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.sku}) · доступно {x.available}</option>)}
            </Select>
          </Field>
          <Field label="Изменение, шт *" error={fe.delta} hint={p ? `Сейчас доступно ${p.available} шт. Минус — списание (брак, потеря), плюс — излишек` : "Минус — списание, плюс — излишек"}>
            <Input name="delta" type="number" step="1" required className="tabular" placeholder="-2" />
          </Field>
          <Field label="Причина *" error={fe.note}>
            <Input name="note" required minLength={3} maxLength={500} placeholder="Брак при приёмке" />
          </Field>
          {isOwner && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="allowNegative" className="size-4" />
              Разрешить отрицательный остаток (только если уверены, что учёт временно расходится)
            </label>
          )}
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormStatus state={state} />
            <div><Button disabled={pending}>{pending ? "Сохранение…" : "Провести"}</Button></div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
