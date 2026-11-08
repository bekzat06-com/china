import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, text, children }: { icon: LucideIcon; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
      <Icon className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {text && <p className="max-w-sm text-xs text-muted-foreground">{text}</p>}
      {children}
    </div>
  );
}
