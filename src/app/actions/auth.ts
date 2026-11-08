"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, destroySession, getClientIp, getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit, registerFailure, resetAttempts } from "@/lib/auth/rate-limit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Введите корректный e-mail"),
  password: z.string().min(1, "Введите пароль").max(200),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

// Фиктивный хеш для проверки, когда пользователь не найден
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, next } = parsed.data;

  const key = `${await getClientIp()}:${email}`;
  const limit = checkRateLimit(key);
  if (!limit.allowed) return { error: `Слишком много попыток. Повторите через ${limit.retryInMin} мин.` };

  const user = await db.user.findUnique({ where: { email } });
  // Сравниваем пароль даже если пользователя нет — чтобы время ответа не выдавало существование e-mail
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    registerFailure(key);
    await audit("auth.login_failed", { details: { email } });
    return { error: "Неверный e-mail или пароль" };
  }

  resetAttempts(key);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user);
  await audit("auth.login", { userId: user.id });
  // Разрешаем перенаправление только внутри сайта (защита от open redirect)
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  redirect(target);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await audit("auth.logout", { userId: user.id });
  await destroySession();
  redirect("/login");
}
