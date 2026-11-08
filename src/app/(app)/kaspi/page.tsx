import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Kaspi Магазин" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title={"Kaspi Магазин"} stage={3} description={"Подключение к официальному API Kaspi Магазина"} features={["Синхронизация заказов через официальный API (если доступен вашему магазину)", "Сверка комиссий и статусов заказов", "Импорт файлов из кабинета продавца как резервный вариант"]} prepared={["Источник заказа KASPI_API и защита от дублей (номер заказа) в базе", "Переменная KASPI_API_TOKEN в .env.example"]} limits={["Перед реализацией изучим актуальную официальную документацию Kaspi — методы API не выдумываем", "Если данные недоступны через API — только ручной импорт, с явной пометкой", "ИИ никогда не меняет цены и не принимает заказы без вашего подтверждения"]} />;
}
