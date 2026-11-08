import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Telegram-бот" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title={"Telegram-бот"} stage={7} description={"Ежедневные отчёты и команды для владельца"} features={["Ежедневный отчёт: выручка, заказы, прибыль, возвраты, лидеры, низкие остатки, рекомендации", "Команды /today /profit /products /competitors /china /stock /report", "Расписание через n8n или встроенный планировщик"]} prepared={["Данные для отчёта уже считаются на главной странице"]} limits={["Бот отвечает только авторизованному владельцу (по chat_id)"]} />;
}
