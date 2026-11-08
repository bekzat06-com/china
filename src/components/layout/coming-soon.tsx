import { CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  title, stage, description, features, limits = [], prepared = [],
}: { title: string; stage: number; description: string; features: string[]; limits?: string[]; prepared?: string[] }) {
  return (
    <div className="max-w-4xl">
      <PageHeader title={title} description={description}>
        <Badge variant="muted"><Clock className="size-3" /> Этап {stage} — ещё не подключено</Badge>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Что будет в модуле</CardTitle></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {features.map((f) => (
                <li key={f} className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          {prepared.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Уже подготовлено</CardTitle></CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {prepared.map((f) => (
                    <li key={f} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />{f}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {limits.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Правила и ограничения</CardTitle></CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {limits.map((f) => (
                    <li key={f} className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />{f}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
