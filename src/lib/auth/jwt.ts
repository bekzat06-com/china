// Подпись и проверка токена сессии. Работает и в middleware (Edge), и на сервере.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ilyas_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 дней

export interface SessionPayload {
  sub: string; // id пользователя
  role: "OWNER" | "MANAGER" | "VIEWER";
  name: string;
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("CHANGE_ME")) {
    throw new Error("AUTH_SECRET не задан или слишком короткий (нужно ≥ 32 символов). См. .env.example");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role as SessionPayload["role"], name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
