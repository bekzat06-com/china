import "server-only";
import type { OrderSource, OrderStatus, Prisma } from "@prisma/client";
import { computeStock, NegativeStockError, type MovementKind } from "./stock";
import { allocateFifo } from "./fifo";
import { toNum } from "@/lib/utils";

/**
 * Складские операции. Все функции работают внутри транзакции (tx) и блокируют
 * строку товара (SELECT … FOR UPDATE), чтобы параллельные продажи не увели остаток в минус.
 */
type Tx = Prisma.TransactionClient;

async function lockProduct(tx: Tx, productId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
  if (rows.length === 0) throw new Error("Товар не найден");
}

export async function stockLevel(tx: Tx, productId: string) {
  const grouped = await tx.stockMovement.groupBy({ by: ["type"], where: { productId }, _sum: { quantity: true } });
  return computeStock(grouped.map((g) => ({ type: g.type as MovementKind, quantity: g._sum.quantity ?? 0 })));
}

/** Оценка себестоимости, если партий нет: последняя партия → последний расчёт → null */
export async function estimateUnitCost(tx: Tx, productId: string): Promise<number | null> {
  const batch = await tx.stockBatch.findFirst({ where: { productId }, orderBy: { receivedAt: "desc" }, select: { unitCostKzt: true } });
  if (batch) return toNum(batch.unitCostKzt);
  const calc = await tx.costCalculation.findFirst({ where: { productId }, orderBy: { createdAt: "desc" }, select: { results: true } });
  const landed = (calc?.results as { landedCostPerUnitKzt?: number } | undefined)?.landedCostPerUnitKzt;
  return typeof landed === "number" ? landed : null;
}

export async function receiveStock(
  tx: Tx,
  p: { productId: string; quantity: number; unitCostKzt: number; receivedAt?: Date; supplierId?: string | null; note?: string | null },
) {
  await lockProduct(tx, p.productId);
  const batch = await tx.stockBatch.create({
    data: {
      productId: p.productId,
      quantity: p.quantity,
      remaining: p.quantity,
      unitCostKzt: p.unitCostKzt,
      receivedAt: p.receivedAt ?? new Date(),
      supplierId: p.supplierId ?? null,
      note: p.note ?? null,
    },
  });
  await tx.stockMovement.create({
    data: {
      productId: p.productId,
      type: "IN",
      quantity: p.quantity,
      unitCostKzt: p.unitCostKzt,
      refType: "batch",
      refId: batch.id,
      note: p.note ?? null,
      createdAt: p.receivedAt ?? new Date(),
    },
  });
  return batch;
}

/** Списание по FIFO. Возвращает себестоимость единицы (или оценку, если партий не хватило). */
async function consumeFifo(tx: Tx, productId: string, quantity: number) {
  const batches = await tx.stockBatch.findMany({
    where: { productId, remaining: { gt: 0 } },
    select: { id: true, remaining: true, unitCostKzt: true, receivedAt: true },
  });
  const fifo = allocateFifo(
    batches.map((b) => ({ ...b, unitCostKzt: toNum(b.unitCostKzt) ?? 0 })),
    quantity,
  );
  for (const a of fifo.allocations) {
    await tx.stockBatch.update({ where: { id: a.batchId }, data: { remaining: { decrement: a.quantity } } });
  }
  let unitCost = fifo.unitCostKzt;
  if (fifo.shortage > 0) {
    // часть единиц без партии (разрешённый минус) — оцениваем по последней известной цене
    const est = (await estimateUnitCost(tx, productId)) ?? unitCost ?? 0;
    unitCost = Math.round((((unitCost ?? 0) * fifo.allocatedQty + est * fifo.shortage) / quantity) * 100) / 100;
  }
  return unitCost ?? 0;
}

export async function sellFromStock(
  tx: Tx,
  p: { productId: string; quantity: number; orderId: string; at: Date; allowNegative?: boolean },
) {
  await lockProduct(tx, p.productId);
  const level = await stockLevel(tx, p.productId);
  if (!p.allowNegative && p.quantity > level.available) throw new NegativeStockError(level.available, p.quantity);
  const unitCostKzt = await consumeFifo(tx, p.productId, p.quantity);
  await tx.stockMovement.create({
    data: { productId: p.productId, type: "OUT", quantity: p.quantity, unitCostKzt, refType: "order", refId: p.orderId, createdAt: p.at },
  });
  return unitCostKzt;
}

/** Возврат на склад отдельной партией (по себестоимости исходной продажи) */
export async function returnToStock(
  tx: Tx,
  p: { productId: string; quantity: number; unitCostKzt: number; orderId: string; note: string },
) {
  await lockProduct(tx, p.productId);
  await tx.stockBatch.create({
    data: { productId: p.productId, quantity: p.quantity, remaining: p.quantity, unitCostKzt: p.unitCostKzt, note: p.note },
  });
  await tx.stockMovement.create({
    data: { productId: p.productId, type: "RETURN", quantity: p.quantity, unitCostKzt: p.unitCostKzt, refType: "order", refId: p.orderId, note: p.note },
  });
}

/** Инвентаризация: delta > 0 — излишек (новая партия), delta < 0 — списание по FIFO */
export async function adjustStock(
  tx: Tx,
  p: { productId: string; delta: number; note: string; unitCostKzt?: number | null; allowNegative?: boolean },
) {
  await lockProduct(tx, p.productId);
  if (p.delta === 0) throw new Error("Изменение не может быть нулевым");
  let unitCostKzt: number | null;
  if (p.delta < 0) {
    const level = await stockLevel(tx, p.productId);
    const qty = -p.delta;
    if (!p.allowNegative && qty > level.available) throw new NegativeStockError(level.available, qty);
    unitCostKzt = await consumeFifo(tx, p.productId, qty);
  } else {
    unitCostKzt = p.unitCostKzt ?? (await estimateUnitCost(tx, p.productId)) ?? 0;
    await tx.stockBatch.create({
      data: { productId: p.productId, quantity: p.delta, remaining: p.delta, unitCostKzt, note: `Инвентаризация: ${p.note}` },
    });
  }
  await tx.stockMovement.create({
    data: { productId: p.productId, type: "ADJUST", quantity: p.delta, unitCostKzt, refType: "manual", note: p.note },
  });
}

export interface NewOrderItem {
  productId: string;
  quantity: number;
  unitPriceKzt: number;
  commissionKzt: number;
  deliveryKzt: number;
}

/**
 * Создание заказа. Если deductStock — товар списывается со склада (FIFO),
 * отменённые заказы склад не трогают, возвращённые — списываются и сразу возвращаются.
 */
export async function createOrder(
  tx: Tx,
  p: {
    externalId: string | null;
    source: OrderSource;
    status: OrderStatus;
    orderedAt: Date;
    city: string | null;
    items: NewOrderItem[];
    deductStock: boolean;
    allowNegative?: boolean;
  },
) {
  const order = await tx.order.create({
    data: { externalId: p.externalId, source: p.source, status: p.status, orderedAt: p.orderedAt, customerCity: p.city },
  });
  const warnings: string[] = [];
  for (const item of p.items) {
    let unitCostKzt: number;
    if (p.deductStock && p.status !== "CANCELLED") {
      unitCostKzt = await sellFromStock(tx, {
        productId: item.productId,
        quantity: item.quantity,
        orderId: order.id,
        at: p.orderedAt,
        allowNegative: p.allowNegative,
      });
      if (p.status === "RETURNED") {
        await returnToStock(tx, { productId: item.productId, quantity: item.quantity, unitCostKzt, orderId: order.id, note: "Возврат (из импорта)" });
      }
    } else {
      const est = await estimateUnitCost(tx, item.productId);
      if (est === null) warnings.push("Себестоимость неизвестна — учтена как 0 ₸");
      unitCostKzt = est ?? 0;
    }
    await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        returnedQty: p.status === "RETURNED" ? item.quantity : 0,
        unitPriceKzt: item.unitPriceKzt,
        commissionKzt: item.commissionKzt,
        deliveryKzt: item.deliveryKzt,
        unitCostKzt,
      },
    });
  }
  return { order, warnings };
}

/** Сколько единиц товара по заказу реально ушло со склада и ещё не вернулось */
async function netShipped(tx: Tx, orderId: string) {
  const moves = await tx.stockMovement.groupBy({
    by: ["productId", "type"],
    where: { refType: "order", refId: orderId, type: { in: ["OUT", "RETURN"] } },
    _sum: { quantity: true },
  });
  const net = new Map<string, number>();
  for (const m of moves) {
    const q = m._sum.quantity ?? 0;
    net.set(m.productId, (net.get(m.productId) ?? 0) + (m.type === "OUT" ? q : -q));
  }
  return net;
}

/** Полный возврат или отмена заказа: товар, ушедший со склада, возвращается отдельной партией */
export async function reverseOrder(tx: Tx, orderId: string, newStatus: "RETURNED" | "CANCELLED") {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new Error("Заказ не найден");
  if (order.status === "CANCELLED" || order.status === "RETURNED") throw new Error("Заказ уже отменён или возвращён");
  if (newStatus === "RETURNED" && order.status !== "COMPLETED") throw new Error("Вернуть можно только выполненный заказ");
  const shipped = await netShipped(tx, orderId);
  const note = newStatus === "RETURNED" ? "Возврат покупателя" : "Отмена заказа";
  for (const item of order.items) {
    const qty = Math.min(shipped.get(item.productId) ?? 0, item.quantity);
    if (qty > 0) {
      await returnToStock(tx, { productId: item.productId, quantity: qty, unitCostKzt: toNum(item.unitCostKzt) ?? 0, orderId, note });
      shipped.set(item.productId, (shipped.get(item.productId) ?? 0) - qty);
    }
    if (newStatus === "RETURNED") await tx.orderItem.update({ where: { id: item.id }, data: { returnedQty: item.quantity } });
  }
  await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
}
