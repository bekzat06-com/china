"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Calculator, ChartLine, Factory, Languages, LayoutDashboard, Menu, Package, Radar, ScrollText,
  Send, Settings, Sparkles, Store, Swords, Warehouse, X, type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Calculator, ChartLine, Factory, Languages, LayoutDashboard, Package, Radar, ScrollText,
  Send, Settings, Sparkles, Store, Swords, Warehouse,
};

function NavList({ isOwner, onNavigate }: { isOwner: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </p>
          {group.items
            .filter((i) => !i.ownerOnly || isOwner)
            .map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors",
                    active ? "bg-accent font-medium text-accent-foreground" : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {!item.ready && (
                    <span className="ml-auto rounded bg-muted px-1.5 text-[10px] text-muted-foreground" title={`Этап ${item.stage}`}>
                      эт.{item.stage}
                    </span>
                  )}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-5 py-4">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">I</div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">ILYAS AI</p>
        <p className="text-[11px] text-muted-foreground">Commerce</p>
      </div>
    </Link>
  );
}

export function Sidebar({ isOwner }: { isOwner: boolean }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r bg-sidebar lg:block">
      <Brand />
      <NavList isOwner={isOwner} />
    </aside>
  );
}

/** Мобильное меню (кнопка-«гамбургер» + выезжающая панель) */
export function MobileNav({ isOwner }: { isOwner: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="lg:hidden">
      <button
        aria-label="Открыть меню"
        className="flex size-9 items-center justify-center rounded-lg hover:bg-muted"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-sidebar shadow-xl">
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button aria-label="Закрыть меню" className="rounded-lg p-2 hover:bg-muted" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <NavList isOwner={isOwner} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
