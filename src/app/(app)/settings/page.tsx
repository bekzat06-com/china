import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getBusinessSettings } from "@/lib/settings";
import { PageHeader } from "@/components/layout/page-header";
import { DemoDataForm, SettingsForm } from "@/components/settings-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Настройки" };
export const dynamic = "force-dynamic";

const INTEGRATIONS = [
  { name: "PostgreSQL", env: "DATABASE_URL", stage: 1 },
  { name: "Kaspi API", env: "KASPI_API_TOKEN", stage: 3 },
  { name: "Anthropic (Claude)", env: "ANTHROPIC_API_KEY", stage: 6 },
  { name: "OpenAI", env: "OPENAI_API_KEY", stage: 6 },
  { name: "Telegram-бот", env: "TELEGRAM_BOT_TOKEN", stage: 7 },
];

export default async function SettingsPage() {
  const user = await requireUser();
  const [s, demoProducts, demoOrders] = await Promise.all([
    getBusinessSettings(),
    db.product.count({ where: { isDemo: true } }),
    db.order.count({ where: { isDemo: true } }),
  ]);
  const isOwner = user.role === "OWNER";
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <PageHeader title="Настройки" description="Курсы, ставки и параметры, от которых зависят все расчёты" />
      <SettingsForm s={s} canEdit={isOwner} />
      <Card>
        <CardHeader>
          <CardTitle>Интеграции</CardTitle>
          <CardDescription>Ключи хранятся только в файле .env на сервере и никогда не передаются в браузер. Здесь показано лишь, заданы ли они.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y text-sm">
          {INTEGRATIONS.map((i) => {
            const configured = Boolean(process.env[i.env]);
            return (
              <div key={i.env} className="flex items-center justify-between py-2">
                <div>
                  <p>{i.name}</p>
                  <p className="text-[11px] text-muted-foreground">{i.env} · этап {i.stage}</p>
                </div>
                <span className={configured ? "text-success" : "text-muted-foreground"}>{configured ? "ключ задан" : "не подключено"}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
      {isOwner && <DemoDataForm counts={{ products: demoProducts, orders: demoOrders }} />}
    </div>
  );
}
