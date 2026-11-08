"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@/lib/finance/sales-analytics";

const compact = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export function RevenueChart({ data }: { data: DailyPoint[] }) {
  return (
    <div>
      {/* Легенда: две серии — подписаны текстом, не только цветом */}
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: "var(--series-1)" }} /> Выручка
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: "var(--series-2)" }} /> Прибыль по заказам
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-2)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--series-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v) => compact.format(v)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              labelFormatter={(l) => new Date(String(l)).toLocaleDateString("ru-RU")}
              formatter={(v: number, name: string) => [`${full.format(v)} ₸`, name === "revenueKzt" ? "Выручка" : "Прибыль"]}
            />
            <Area type="monotone" dataKey="revenueKzt" stroke="var(--series-1)" strokeWidth={2} fill="url(#gRev)" />
            <Area type="monotone" dataKey="profitKzt" stroke="var(--series-2)" strokeWidth={2} fill="url(#gProfit)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
