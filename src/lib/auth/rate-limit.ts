// Простое ограничение попыток входа (в памяти процесса).
// Для нескольких серверов заменить на Redis — архитектура это позволяет.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function checkRateLimit(key: string): { allowed: boolean; retryInMin: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) return { allowed: true, retryInMin: 0 };
  if (entry.count >= MAX_ATTEMPTS) return { allowed: false, retryInMin: Math.ceil((entry.resetAt - now) / 60000) };
  return { allowed: true, retryInMin: 0 };
}

export function registerFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export function resetAttempts(key: string) {
  attempts.delete(key);
}
