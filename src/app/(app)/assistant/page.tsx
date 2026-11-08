import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "ИИ-аналитик и финансовый директор" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title={"ИИ-аналитик и финансовый директор"} stage={6} description={"Вопросы о бизнесе на русском языке — ответы по данным вашей базы"} features={["«Сколько я заработал сегодня?», «Где я теряю деньги?», «Что закупить при бюджете 500 000 ₸?»", "Сценарии: как изменится прибыль при снижении цен конкурентов", "Ответ всегда со ссылкой на цифры из базы"]} prepared={["Финансовые функции, к которым ИИ будет обращаться как к инструментам", "Переменные ANTHROPIC_API_KEY / OPENAI_API_KEY в .env.example"]} limits={["ИИ не выдумывает финансовые показатели — только данные из базы", "ИИ не оплачивает, не меняет цены и не оформляет заказы"]} />;
}
