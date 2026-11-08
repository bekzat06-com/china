// Резервная копия базы: npm run db:backup  → файл backups/ilyas_YYYY-MM-DD_HH-MM.sql
// Требуется установленный pg_dump (входит в PostgreSQL) или Docker.
// Восстановление: psql "<DATABASE_URL>" -f backups/<файл>.sql
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";

function loadEnv() {
  if (process.env.DATABASE_URL || !existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан");
  process.exit(1);
}
mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
const file = `backups/ilyas_${stamp}.sql`;
// pg_dump не понимает параметр ?schema= от Prisma — убираем его
const cleanUrl = url.replace(/\?.*$/, "");
try {
  execFileSync("pg_dump", ["--no-owner", "--file", file, cleanUrl], { stdio: "inherit" });
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  // pg_dump не установлен (типично для Windows) — делаем копию через контейнер базы в Docker
  console.log("pg_dump не найден — использую Docker (docker compose exec db pg_dump)");
  const sql = execFileSync("docker", ["compose", "exec", "-T", "db", "pg_dump", "--no-owner", "-U", "ilyas", "ilyas_commerce"], {
    maxBuffer: 1024 * 1024 * 1024,
  });
  writeFileSync(file, sql);
}
console.log(`Резервная копия создана: ${file}`);
