"use client";
import { useActionState } from "react";
import { saveSettingsAction, deleteDemoDataAction, type SettingsState, type DemoState } from "@/app/actions/settings";
import type { BusinessSettings } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

export function SettingsForm({ s, canEdit }: { s: BusinessSettings; canEdit: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  const f = (name: keyof BusinessSettings, label: string, hint?: string, step = "any") => (
    <Field label={label} hint={hint}>
      <Input name={name} type="number" step={step} min="0" defaultValue={String(s[name] ?? "")} disabled={!canEdit} required className="tabular" />
    </Field>
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Курсы валют</CardTitle>
          <CardDescription>
            Пока вводятся вручную. Автоматическое обновление по курсу Нацбанка РК — этап 7.
            {s.ratesUpdatedAt && ` Обновлено: ${new Date(s.ratesUpdatedAt).toLocaleString("ru-RU")}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {f("cnyToKzt", "1 CNY = ₸")}
          {f("usdToKzt", "1 USD = ₸")}
          <Field label="Источник курса">
            <Input name="ratesSource" defaultValue={s.ratesSource} disabled={!canEdit} maxLength={200} />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ставки по умолчанию</CardTitle>
          <CardDescription>
            Подставляются в калькулятор. Это <b>примеры</b>: комиссия Kaspi зависит от категории товара, налог — от вашего режима ИП
            и решений местных органов. Проверьте у бухгалтера и в кабинете продавца Kaspi.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {f("kaspiCommissionPct", "Комиссия Kaspi, %")}
          {f("sellerTaxPct", "Налог продавца, % от выручки")}
          {f("customerDeliveryKzt", "Доставка покупателю, ₸/шт")}
          {f("intlRateUsdPerKg", "Карго, $ за кг")}
          {f("intlRateUsdPerM3", "Карго, $ за м³")}
          {f("returnRatePct", "Ожидаемые возвраты, %")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Закупки и бюджет</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {f("leadTimeDays", "Срок поставки из Китая, дн.", "Производство + доставка", "1")}
          {f("safetyStockDays", "Страховой запас, дн.", undefined, "1")}
          {f("budgetKzt", "Бюджет на закупки, ₸")}
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" name="verifiedByOwner" defaultChecked={s.verifiedByOwner} disabled={!canEdit} className="size-4" />
            Я проверил(а) ставки и курсы — они соответствуют моему бизнесу
          </label>
        </CardContent>
      </Card>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? "Сохранение…" : "Сохранить настройки"}</Button>
          {state.ok && <span className="text-sm text-success">Сохранено</span>}
          {state.error && <span className="text-sm text-danger">{state.error}</span>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Изменять настройки может только владелец.</p>
      )}
    </form>
  );
}

export function DemoDataForm({ counts }: { counts: { products: number; orders: number } }) {
  const [state, action, pending] = useActionState<DemoState, FormData>(deleteDemoDataAction, {});
  return (
    <Card id="demo" className="border-warning/50">
      <CardHeader>
        <CardTitle>Демонстрационные данные</CardTitle>
        <CardDescription>
          Сейчас в базе: {counts.products} демо-товаров и {counts.orders} демо-заказов. Удаление необратимо, поэтому нужен ваш пароль.
          Ваши реальные данные не затрагиваются.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {counts.products + counts.orders === 0 ? (
          <p className="text-sm text-muted-foreground">Демо-данных нет.</p>
        ) : (
          <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Пароль владельца для подтверждения" className="sm:w-72">
              <Input name="password" type="password" required autoComplete="current-password" />
            </Field>
            <Button type="submit" variant="danger" disabled={pending}>{pending ? "Удаление…" : "Удалить демо-данные"}</Button>
          </form>
        )}
        {state.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}
        {state.message && <p className="mt-2 text-sm text-success">{state.message}</p>}
      </CardContent>
    </Card>
  );
}
