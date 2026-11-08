import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Продажи и отчёты" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title={"Продажи и отчёты"} stage={2} description={"Заказы, импорт Excel/CSV, отчёты о прибыли"} features={["Импорт заказов из Excel/CSV (выгрузка из кабинета Kaspi)", "Ручной ввод заказов и расходов", "Отчёты: прибыль по товарам, категориям, периодам", "ABC-анализ, XYZ-анализ при достаточном объёме данных", "Оборачиваемость", "Выгрузка отчётов в Excel"]} prepared={["Расчёт выручки, прибыли, ROI, ABC (покрыт тестами)", "Таблицы заказов и расходов в базе"]} />;
}
