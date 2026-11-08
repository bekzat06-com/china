"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Вкладки внутри раздела (Склад, Продажи) */
export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 rounded-lg border bg-card p-0.5">
        {items.map((i) => {
          const active = pathname === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const INVENTORY_TABS = [
  { href: "/inventory", label: "Остатки и закупки" },
  { href: "/inventory/receive", label: "Приход" },
  { href: "/inventory/adjust", label: "Инвентаризация" },
  { href: "/inventory/movements", label: "Движения" },
];

export const SALES_TABS = [
  { href: "/sales", label: "Заказы" },
  { href: "/sales/new", label: "Новый заказ" },
  { href: "/sales/import", label: "Импорт Excel/CSV" },
  { href: "/sales/expenses", label: "Расходы" },
  { href: "/sales/reports", label: "Отчёты" },
];
