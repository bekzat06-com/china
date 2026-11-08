"use client";
import { useActionState } from "react";
import { saveProductAction, type ProductFormState } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

export interface ProductFormValues {
  id?: string;
  sku?: string;
  name?: string;
  nameZh?: string | null;
  description?: string | null;
  categoryId?: string | null;
  status?: string;
  purchasePriceCny?: number | null;
  salePriceKzt?: number | null;
  kaspiCommissionPct?: number | null;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  minStock?: number;
  needsCertification?: boolean;
  kaspiProductUrl?: string | null;
}

const v = (x: unknown) => (x === null || x === undefined ? "" : String(x));

export function ProductForm({ values = {}, categories }: { values?: ProductFormValues; categories: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProductAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Card>
        <CardHeader><CardTitle>Основное</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Название *" error={fe.name} className="sm:col-span-2">
            <Input name="name" defaultValue={v(values.name)} required maxLength={200} />
          </Field>
          <Field label="Артикул (SKU) *" error={fe.sku} hint="Латиница, цифры, - _ .">
            <Input name="sku" defaultValue={v(values.sku)} required maxLength={64} />
          </Field>
          <Field label="Название на китайском" error={fe.nameZh} hint="Для поиска на 1688 / Alibaba">
            <Input name="nameZh" defaultValue={v(values.nameZh)} lang="zh" />
          </Field>
          <Field label="Категория">
            <Select name="categoryId" defaultValue={v(values.categoryId)}>
              <option value="">— без категории —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Статус">
            <Select name="status" defaultValue={values.status ?? "ACTIVE"}>
              <option value="IDEA">Идея / исследование</option>
              <option value="ACTIVE">Продаётся</option>
              <option value="PAUSED">Приостановлен</option>
              <option value="ARCHIVED">Архив</option>
            </Select>
          </Field>
          <Field label="Ссылка на товар в Kaspi" error={fe.kaspiProductUrl} className="sm:col-span-2">
            <Input name="kaspiProductUrl" type="url" defaultValue={v(values.kaspiProductUrl)} placeholder="https://kaspi.kz/shop/p/..." />
          </Field>
          <Field label="Описание / заметки" className="sm:col-span-2">
            <Textarea name="description" defaultValue={v(values.description)} maxLength={2000} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Цены и параметры</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Закупочная цена, ¥ CNY" error={fe.purchasePriceCny}>
            <Input name="purchasePriceCny" type="number" step="0.01" min="0" defaultValue={v(values.purchasePriceCny)} />
          </Field>
          <Field label="Цена продажи, ₸" error={fe.salePriceKzt}>
            <Input name="salePriceKzt" type="number" step="1" min="0" defaultValue={v(values.salePriceKzt)} />
          </Field>
          <Field label="Комиссия Kaspi, %" error={fe.kaspiCommissionPct} hint="Пусто — из настроек">
            <Input name="kaspiCommissionPct" type="number" step="0.1" min="0" max="100" defaultValue={v(values.kaspiCommissionPct)} />
          </Field>
          <Field label="Вес с упаковкой, кг" error={fe.weightKg}>
            <Input name="weightKg" type="number" step="0.001" min="0" defaultValue={v(values.weightKg)} />
          </Field>
          <Field label="Мин. остаток, шт" error={fe.minStock}>
            <Input name="minStock" type="number" step="1" min="0" defaultValue={v(values.minStock ?? 0)} />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="needsCertification" defaultChecked={values.needsCertification} className="size-4 accent-[var(--primary)]" />
              Требуется сертификация
            </label>
          </div>
          <Field label="Длина, см" error={fe.lengthCm}>
            <Input name="lengthCm" type="number" step="0.1" min="0" defaultValue={v(values.lengthCm)} />
          </Field>
          <Field label="Ширина, см" error={fe.widthCm}>
            <Input name="widthCm" type="number" step="0.1" min="0" defaultValue={v(values.widthCm)} />
          </Field>
          <Field label="Высота, см" error={fe.heightCm}>
            <Input name="heightCm" type="number" step="0.1" min="0" defaultValue={v(values.heightCm)} />
          </Field>
        </CardContent>
      </Card>

      {state.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Сохранение…" : values.id ? "Сохранить изменения" : "Создать товар"}</Button>
      </div>
    </form>
  );
}
