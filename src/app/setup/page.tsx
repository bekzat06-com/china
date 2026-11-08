import { redirect } from "next/navigation";

export const metadata = { title: "Настройка" };
export const dynamic = "force-dynamic";

// Показывается, пока к сайту не подключена база данных
export default function SetupPage() {
  if (process.env.DATABASE_URL) redirect("/login");
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">ILYAS AI COMMERCE: нужна база данных</h1>
      <p className="text-sm text-muted-foreground">Сайт развёрнут, но база данных PostgreSQL ещё не подключена.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>Откройте проект в Vercel → вкладка <b>Storage</b> → <b>Create Database</b>.</li>
        <li>Выберите <b>Neon (Serverless Postgres)</b>, бесплатный план, регион Frankfurt.</li>
        <li>Подключите базу к этому проекту (переменная <code>DATABASE_URL</code> добавится сама).</li>
        <li>Сделайте повторный деплой (Deployments → Redeploy) — таблицы и учётная запись владельца создадутся автоматически.</li>
      </ol>
    </main>
  );
}
