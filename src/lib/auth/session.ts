import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./jwt";
import type { Role, User } from "@prisma/client";

const ROLE_LEVEL: Record<Role, number> = { VIEWER: 1, MANAGER: 2, OWNER: 3 };

export function hasRole(role: Role, min: Role) {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[min];
}

export async function createSession(user: Pick<User, "id" | "role" | "name">) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // недоступен JavaScript в браузере
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Текущий пользователь или null. Всегда перепроверяет пользователя в базе (вдруг его отключили). */
export async function getCurrentUser() {
  const payload = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Для страниц: нет входа → на /login. Нет прав → ошибка. */
export async function requireUser(minRole: Role = "VIEWER"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasRole(user.role, minRole)) throw new Error("Недостаточно прав для этого действия");
  return user;
}

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}
