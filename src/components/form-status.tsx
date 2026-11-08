import type { ActionState } from "@/lib/action-utils";

export function FormStatus({ state }: { state: ActionState }) {
  if (state.error) return <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>;
  if (state.ok && state.message) return <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{state.message}</p>;
  return null;
}
