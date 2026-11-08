// Сборка на Vercel: миграции базы → начальные данные → сборка Next.js.
// Если база ещё не подключена — собираем сайт без шагов с базой (он покажет инструкцию).
import { execSync } from "node:child_process";

const run = (cmd, env = process.env) => execSync(cmd, { stdio: "inherit", env });

if (process.env.DATABASE_URL) {
  // Для миграций нужен прямой (не пуловый) адрес базы, если провайдер его даёт (Neon: DATABASE_URL_UNPOOLED)
  const direct = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  run("npx prisma migrate deploy", { ...process.env, DATABASE_URL: direct });
  if (process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) {
    run("npx tsx prisma/seed.ts", { ...process.env, DATABASE_URL: direct });
  } else {
    console.warn("⚠ OWNER_EMAIL / OWNER_PASSWORD не заданы — владелец не создан");
  }
} else {
  console.warn("⚠ DATABASE_URL не задан — база не подключена. Сайт покажет страницу настройки.");
}
run("npx next build");
