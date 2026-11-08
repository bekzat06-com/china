import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Поставщики в Китае" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title={"Поставщики в Китае"} stage={5} description={"Каталог поставщиков и сравнение предложений"} features={["Каталог поставщиков с контактами и оценкой рисков", "Сравнение предложений: цена, MOQ, образцы, сроки, оплата, доставка", "Импорт ссылок, КП, скриншотов и Excel", "Перевод названия товара на китайский для поиска на 1688/Alibaba"]} prepared={["Таблицы поставщиков и предложений в базе", "Поле «название на китайском» у товаров"]} limits={["Не генерируем вымышленные цены, ссылки, контакты и поставщиков", "Без официальной интеграции — только загруженные вами данные"]} />;
}
