import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Переговоры с поставщиками (WeChat)" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title={"Переговоры с поставщиками (WeChat)"} stage={5} description={"ИИ-помощник для переписки на китайском"} features={["Перевод RU ↔ ZH", "Шаблоны: запрос КП, скидки, MOQ, вес и габариты, упаковка, фото/видео, сертификаты, сроки", "Режим «ИИ-помощник»: вставили сообщение поставщика → перевод + готовый ответ", "История переписки по каждому поставщику"]} prepared={["Таблица истории переговоров со статусами «черновик → одобрено → отправлено»"]} limits={["Без неофициальной автоматизации личного WeChat", "Отправка сообщений, закупки и платежи — только после вашего подтверждения"]} />;
}
