import { NextResponse, type NextRequest } from "next/server";
import type { OrderSource, OrderStatus, Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { getReportsData } from "@/lib/queries/reports";
import { getStockOverview } from "@/lib/queries/dashboard";
import { ORDER_SOURCE_LABEL, ORDER_STATUS_LABEL } from "@/lib/labels";
import { IMPORT_FIELDS } from "@/lib/import/parse";
import { toNum } from "@/lib/utils";

const fmtDate = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 16).replace("T", " ");

function csvResponse(name: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  const { kind } = await params;
  const sp = req.nextUrl.searchParams;
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === "import-template") {
    return csvResponse("shablon_importa_zakazov.csv", toCsv(IMPORT_FIELDS.map((f) => f.label), [["KSP-1001", "08.11.2026 14:30", "SKU-001", 2, 4990, 1198, 0, "Выдан", "Алматы"]]));
  }

  if (kind === "orders") {
    const where: Prisma.OrderWhereInput = {};
    const period = sp.get("period") ?? "30";
    if (period !== "all" && Number(period) > 0) where.orderedAt = { gte: new Date(Date.now() - Number(period) * 86400_000) };
    const status = sp.get("status");
    if (status && status in ORDER_STATUS_LABEL) where.status = status as OrderStatus;
    const source = sp.get("source");
    if (source && source in ORDER_SOURCE_LABEL) where.source = source as OrderSource;
    const items = await db.orderItem.findMany({
      where: { order: where },
      take: 50_000,
      orderBy: { order: { orderedAt: "desc" } },
      include: { order: true, product: { select: { sku: true, name: true } } },
    });
    await audit("export.orders", { userId: user.id, details: { rows: items.length } });
    return csvResponse(
      `zakazy_${stamp}.csv`,
      toCsv(
        ["Дата", "Номер заказа", "Источник", "Статус", "Артикул", "Товар", "Кол-во", "Возвращено", "Цена", "Комиссия", "Доставка", "Себестоимость ед.", "Город", "Демо"],
        items.map((i) => [
          fmtDate(i.order.orderedAt), i.order.externalId, ORDER_SOURCE_LABEL[i.order.source], ORDER_STATUS_LABEL[i.order.status],
          i.product.sku, i.product.name, i.quantity, i.returnedQty, toNum(i.unitPriceKzt), toNum(i.commissionKzt), toNum(i.deliveryKzt),
          toNum(i.unitCostKzt), i.order.customerCity, i.order.isDemo ? "да" : "",
        ]),
      ),
    );
  }

  if (kind === "products") {
    const days = [30, 90, 180, 365].includes(Number(sp.get("days"))) ? Number(sp.get("days")) : 90;
    const d = await getReportsData(days);
    await audit("export.products", { userId: user.id, details: { days } });
    return csvResponse(
      `otchet_tovary_${days}dn_${stamp}.csv`,
      toCsv(
        ["Артикул", "Товар", "Категория", "ABC", "XYZ", "Продано", "Возвращено", "Выручка", "Себестоимость", "Комиссия", "Доставка", "Прибыль", "Маржа %", "Остаток", "Оборачиваемость, дн."],
        d.productRows.map((p) => [
          p.sku, p.productName, p.category, p.abcClass, p.xyz?.xyzClass ?? "нет данных", p.unitsSold, p.unitsReturned, p.revenueKzt, p.costKzt,
          p.commissionKzt, p.deliveryKzt, p.profitKzt, p.marginPct, p.stock, p.turnoverDays,
        ]),
      ),
    );
  }

  if (kind === "stock") {
    const s = await getStockOverview();
    await audit("export.stock", { userId: user.id });
    return csvResponse(
      `ostatki_${stamp}.csv`,
      toCsv(
        ["Артикул", "Товар", "На складе", "Резерв", "Доступно", "Продано 30 дн.", "Хватит на, дн.", "Себестоимость ед.", "Стоимость остатка", "Рекомендуемая закупка"],
        s.rows.map((r) => [r.sku, r.name, r.onHand, r.reserved, r.available, r.sold30, r.advice.daysOfCover, r.unitCostKzt, r.stockValueKzt, r.advice.suggestedQty]),
      ),
    );
  }

  return NextResponse.json({ error: "Неизвестный тип выгрузки" }, { status: 404 });
}
