/**
 * Начальное заполнение базы.
 *  - владелец (из OWNER_EMAIL / OWNER_PASSWORD в .env)
 *  - настройки по умолчанию (примерные ставки — проверьте!)
 *  - категории
 *  - ДЕМОНСТРАЦИОННЫЕ товары, склад, заказы и расходы (если SEED_DEMO_DATA=true)
 *
 * Все демо-записи помечены isDemo=true и удаляются в «Настройки → Демо-данные».
 * Цифры демо-данных вымышлены и не отражают реальный рынок.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Детерминированный генератор случайных чисел — при каждом запуске одни и те же демо-данные
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261108);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const CATEGORIES = ["Товары для дома", "Автоаксессуары", "Инструменты", "Вирусные товары"];

interface DemoProduct {
  sku: string;
  name: string;
  nameZh: string;
  category: string;
  cny: number;
  price: number;
  unitCost: number; // себестоимость до склада, ₸ (как будто посчитана калькулятором)
  weight: number;
  dims: [number, number, number];
  commissionPct: number;
  delivery: number; // доставка покупателю за счёт продавца, ₸ за заказ
  popularity: number; // продаж в день в среднем
  stockIn: number;
  minStock: number;
  returnRate: number;
}

const PRODUCTS: DemoProduct[] = [
  { sku: "DEMO-HOME-001", name: "Органайзер для холодильника, 6 шт", nameZh: "冰箱收纳盒 6件套", category: "Товары для дома", cny: 18, price: 6990, unitCost: 2450, weight: 1.1, dims: [35, 25, 15], commissionPct: 12, delivery: 0, popularity: 1.6, stockIn: 160, minStock: 20, returnRate: 0.02 },
  { sku: "DEMO-HOME-002", name: "Вакуумные пакеты для хранения, 10 шт", nameZh: "真空压缩袋 10件", category: "Товары для дома", cny: 14, price: 4990, unitCost: 1650, weight: 0.8, dims: [30, 22, 6], commissionPct: 12, delivery: 0, popularity: 2.2, stockIn: 260, minStock: 30, returnRate: 0.03 },
  { sku: "DEMO-HOME-003", name: "Сушилка для посуды двухъярусная", nameZh: "双层碗碟架", category: "Товары для дома", cny: 32, price: 8990, unitCost: 4900, weight: 2.4, dims: [45, 30, 12], commissionPct: 12, delivery: 1200, popularity: 0.6, stockIn: 70, minStock: 10, returnRate: 0.04 },
  { sku: "DEMO-HOME-004", name: "Сенсорный диспенсер для мыла", nameZh: "自动感应皂液器", category: "Товары для дома", cny: 22, price: 5490, unitCost: 2300, weight: 0.45, dims: [20, 10, 10], commissionPct: 12, delivery: 0, popularity: 0.9, stockIn: 100, minStock: 15, returnRate: 0.06 },
  { sku: "DEMO-AUTO-001", name: "Магнитный держатель телефона в авто", nameZh: "车载磁吸手机支架", category: "Автоаксессуары", cny: 9, price: 3990, unitCost: 980, weight: 0.15, dims: [12, 8, 6], commissionPct: 12, delivery: 0, popularity: 3.1, stockIn: 330, minStock: 40, returnRate: 0.02 },
  { sku: "DEMO-AUTO-002", name: "Беспроводной автомобильный пылесос", nameZh: "车载无线吸尘器", category: "Автоаксессуары", cny: 68, price: 9990, unitCost: 8200, weight: 1.3, dims: [38, 14, 12], commissionPct: 12, delivery: 1200, popularity: 0.8, stockIn: 90, minStock: 10, returnRate: 0.09 },
  { sku: "DEMO-AUTO-003", name: "Складной органайзер в багажник", nameZh: "后备箱折叠收纳箱", category: "Автоаксессуары", cny: 26, price: 7490, unitCost: 3400, weight: 1.6, dims: [50, 32, 8], commissionPct: 12, delivery: 0, popularity: 0.5, stockIn: 60, minStock: 8, returnRate: 0.02 },
  { sku: "DEMO-TOOL-001", name: "Набор бит и головок, 46 предметов", nameZh: "46件套筒批头组合", category: "Инструменты", cny: 24, price: 6490, unitCost: 2900, weight: 1.2, dims: [24, 16, 6], commissionPct: 12, delivery: 0, popularity: 1.2, stockIn: 130, minStock: 15, returnRate: 0.01 },
  { sku: "DEMO-TOOL-002", name: "Аккумуляторная отвёртка 3.6V", nameZh: "3.6V充电式电动螺丝刀", category: "Инструменты", cny: 45, price: 11990, unitCost: 5800, weight: 0.9, dims: [22, 18, 7], commissionPct: 12, delivery: 0, popularity: 0.7, stockIn: 75, minStock: 10, returnRate: 0.04 },
  { sku: "DEMO-TOOL-003", name: "Лазерный уровень, 2 луча", nameZh: "两线激光水平仪", category: "Инструменты", cny: 55, price: 12990, unitCost: 6900, weight: 0.7, dims: [16, 12, 10], commissionPct: 12, delivery: 0, popularity: 0.0, stockIn: 30, minStock: 5, returnRate: 0.03 },
  { sku: "DEMO-VIRAL-001", name: "Проектор звёздного неба", nameZh: "星空投影灯", category: "Вирусные товары", cny: 38, price: 9490, unitCost: 4600, weight: 0.8, dims: [18, 18, 16], commissionPct: 12, delivery: 0, popularity: 1.4, stockIn: 110, minStock: 15, returnRate: 0.05 },
  { sku: "DEMO-VIRAL-002", name: "Портативный блендер USB", nameZh: "便携式USB榨汁杯", category: "Вирусные товары", cny: 21, price: 5990, unitCost: 2600, weight: 0.6, dims: [10, 10, 25], commissionPct: 12, delivery: 0, popularity: 1.0, stockIn: 45, minStock: 15, returnRate: 0.04 },
];

async function seedOwner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password || password.startsWith("CHANGE_ME")) {
    throw new Error("Задайте OWNER_EMAIL и OWNER_PASSWORD в .env");
  }
  if (password.length < 8) throw new Error("OWNER_PASSWORD должен быть не короче 8 символов");
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Владелец ${email} уже существует — пароль не меняю`);
    return existing;
  }
  const user = await db.user.create({
    data: { email, name: process.env.OWNER_NAME || "Владелец", role: "OWNER", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Создан владелец: ${email}`);
  return user;
}

async function seedDemo() {
  const already = await db.product.count({ where: { isDemo: true } });
  if (already > 0) {
    console.log("Демо-данные уже загружены — пропускаю");
    return;
  }
  const categories = Object.fromEntries(
    await Promise.all(
      CATEGORIES.map(async (name) => [name, (await db.category.upsert({ where: { name }, create: { name }, update: {} })).id]),
    ),
  );

  const now = Date.now();
  const DAY = 86400_000;
  let orderCounter = 1000;

  for (const p of PRODUCTS) {
    const product = await db.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        nameZh: p.nameZh,
        categoryId: categories[p.category],
        purchasePriceCny: p.cny,
        salePriceKzt: p.price,
        kaspiCommissionPct: p.commissionPct,
        weightKg: p.weight,
        lengthCm: p.dims[0],
        widthCm: p.dims[1],
        heightCm: p.dims[2],
        minStock: p.minStock,
        isDemo: true,
        description: "Демонстрационный товар. Цены и продажи вымышлены.",
      },
    });

    const receivedAt = new Date(now - 80 * DAY);
    const batch = await db.stockBatch.create({
      data: { productId: product.id, quantity: p.stockIn, remaining: p.stockIn, unitCostKzt: p.unitCost, receivedAt, isDemo: true, note: "Демо-партия" },
    });
    await db.stockMovement.create({
      data: { productId: product.id, type: "IN", quantity: p.stockIn, unitCostKzt: p.unitCost, refType: "batch", refId: batch.id, isDemo: true, createdAt: receivedAt },
    });

    // Генерируем продажи за последние 75 дней, не превышая остаток
    let remaining = p.stockIn;
    const movements: Prisma.StockMovementCreateManyInput[] = [];
    for (let d = 75; d >= 0; d--) {
      // лёгкий рост продаж ближе к сегодняшнему дню + выходные чуть сильнее
      const day = new Date(now - d * DAY);
      const weekend = [0, 6].includes(day.getUTCDay()) ? 1.25 : 1;
      const expected = p.popularity * weekend * (0.7 + 0.6 * (1 - d / 75));
      let count = 0;
      for (let i = 0; i < Math.ceil(expected * 2); i++) if (rand() < expected / Math.ceil(expected * 2)) count++;
      for (let i = 0; i < count; i++) {
        const qty = rand() < 0.12 ? 2 : 1;
        if (remaining < qty) break;
        const r = rand();
        const status = r < 0.02 ? "CANCELLED" : r < 0.02 + p.returnRate ? "RETURNED" : "COMPLETED";
        const orderedAt = new Date(day.getTime() - Math.floor(rand() * 12) * 3600_000);
        const order = await db.order.create({
          data: {
            externalId: `DEMO-${orderCounter++}`,
            source: "MANUAL",
            status,
            orderedAt,
            customerCity: pick(["Алматы", "Алматы", "Алматы", "Астана", "Шымкент", "Караганда"]),
            isDemo: true,
            items: {
              create: {
                productId: product.id,
                quantity: qty,
                unitPriceKzt: p.price,
                commissionKzt: Math.round((p.price * qty * p.commissionPct) / 100),
                deliveryKzt: status === "CANCELLED" ? 0 : p.delivery,
                unitCostKzt: p.unitCost,
              },
            },
          },
        });
        if (status !== "CANCELLED") {
          remaining -= qty;
          movements.push({ productId: product.id, type: "OUT", quantity: qty, unitCostKzt: p.unitCost, refType: "order", refId: order.id, isDemo: true, createdAt: orderedAt });
          if (status === "RETURNED") {
            remaining += qty;
            movements.push({ productId: product.id, type: "RETURN", quantity: qty, unitCostKzt: p.unitCost, refType: "order", refId: order.id, isDemo: true, createdAt: new Date(orderedAt.getTime() + 3 * DAY) });
          }
        }
      }
    }
    if (movements.length) await db.stockMovement.createMany({ data: movements });
    await db.stockBatch.update({ where: { id: batch.id }, data: { remaining } });
  }

  // Общие расходы: реклама раз в неделю, сервисы раз в месяц
  const expenses: Prisma.ExpenseCreateManyInput[] = [];
  for (let w = 0; w < 11; w++) {
    expenses.push({ category: "ADS", amountKzt: 8000 + Math.round(rand() * 6000), date: new Date(now - w * 7 * DAY), note: "Демо: реклама Kaspi", isDemo: true });
  }
  for (let m = 0; m < 3; m++) {
    expenses.push({ category: "SERVICES", amountKzt: 5000, date: new Date(now - m * 30 * DAY), note: "Демо: сервисы и связь", isDemo: true });
  }
  await db.expense.createMany({ data: expenses });
  console.log(`Демо-данные загружены: ${PRODUCTS.length} товаров, ${orderCounter - 1000} заказов`);
}

async function main() {
  await seedOwner();
  await db.setting.upsert({
    where: { key: "business" },
    create: {
      key: "business",
      value: {
        cnyToKzt: 70,
        usdToKzt: 500,
        ratesSource: "пример — обновите по курсу Нацбанка РК",
        kaspiCommissionPct: 12,
        sellerTaxPct: 4,
        customerDeliveryKzt: 0,
        intlRateUsdPerKg: 3,
        intlRateUsdPerM3: 250,
        returnRatePct: 2,
        leadTimeDays: 30,
        safetyStockDays: 14,
        budgetKzt: 500000,
        verifiedByOwner: false,
      },
    },
    update: {},
  });
  for (const name of CATEGORIES) await db.category.upsert({ where: { name }, create: { name }, update: {} });
  if (process.env.SEED_DEMO_DATA === "true") await seedDemo();
  else console.log("SEED_DEMO_DATA != true — демо-данные не загружаются");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
