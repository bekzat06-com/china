"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/session";

const schema = z
  .object({
    current: z.string().min(1, "Введите текущий пароль"),
    next: z.string().min(10, "Новый пароль — минимум 10 символов").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "Пароли не совпадают" })
  .refine((d) => d.next !== d.current, { message: "Новый пароль совпадает со старым" });

export type PasswordState = { ok?: boolean; error?: string };

export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const full = await db.user.findUnique({ where: { id: user.id } });
  if (!full || !(await bcrypt.compare(parsed.data.current, full.passwordHash))) {
    await audit("auth.password_change_denied", { userId: user.id });
    return { error: "Текущий пароль неверный" };
  }
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.next, 12) } });
  await audit("auth.password_changed", { userId: user.id });
  return { ok: true };
}
