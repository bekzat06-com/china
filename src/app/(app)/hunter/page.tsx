import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "AI Product Hunter" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title={"AI Product Hunter"} stage={4} description={"Поиск и оценка перспективных товаров"} features={["Рейтинг товара 0–100 с прозрачной методикой", "Оценка спроса, конкуренции, маржи, окупаемости, сезонности, рисков", "Учёт логистики, сертификации и размера стартовой закупки", "Объяснение ИИ: почему товар рекомендован"]} prepared={["Калькулятор себестоимости — основа оценки маржи и окупаемости", "Статус товара «Идея» для исследования"]} limits={["Для каждой оценки — источник данных, дата и уровень достоверности", "Нет данных — выводится «Недостаточно данных», а не выдуманные цифры"]} />;
}
