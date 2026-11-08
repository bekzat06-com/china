/**
 * FIFO: списание товара «первым пришёл — первым ушёл».
 * Продажа забирает единицы из самых старых партий, себестоимость продажи =
 * средневзвешенная цена забранных единиц.
 */

export interface BatchLike {
  id: string;
  remaining: number;
  unitCostKzt: number;
  receivedAt: Date;
}

export interface FifoAllocation {
  batchId: string;
  quantity: number;
  unitCostKzt: number;
}

export interface FifoResult {
  allocations: FifoAllocation[];
  allocatedQty: number;
  shortage: number; // сколько единиц не хватило в партиях
  unitCostKzt: number | null; // средневзвешенная себестоимость списанных единиц
}

export function allocateFifo(batches: BatchLike[], quantity: number): FifoResult {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Количество должно быть целым и больше 0");
  const sorted = [...batches]
    .filter((b) => b.remaining > 0)
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id));

  const allocations: FifoAllocation[] = [];
  let left = quantity;
  let cost = 0;
  for (const b of sorted) {
    if (left === 0) break;
    const take = Math.min(left, b.remaining);
    allocations.push({ batchId: b.id, quantity: take, unitCostKzt: b.unitCostKzt });
    cost += take * b.unitCostKzt;
    left -= take;
  }
  const allocatedQty = quantity - left;
  return {
    allocations,
    allocatedQty,
    shortage: left,
    unitCostKzt: allocatedQty > 0 ? Math.round((cost / allocatedQty) * 100) / 100 : null,
  };
}
