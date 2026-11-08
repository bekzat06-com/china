import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  current,
  previous,
  hint,
  invert,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  current?: number | null;
  previous?: number | null;
  hint?: string;
  invert?: boolean; // для метрик, где рост — плохо
}) {
  let delta: number | null = null;
  if (current != null && previous != null && previous !== 0) delta = ((current - previous) / Math.abs(previous)) * 100;
  const good = delta !== null && (invert ? delta < 0 : delta > 0);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="tabular mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        {delta !== null && (
          <span className={cn("inline-flex items-center font-medium", good ? "text-success" : "text-danger")}>
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        <span className="truncate">{delta !== null ? "к прошлому периоду" : hint ?? ""}</span>
      </div>
    </Card>
  );
}
