"use client";
import { useEffect, useState } from "react";
import type { ActionState } from "@/lib/action-utils";

/** Ключ для сброса формы после каждого успешного сохранения (и только тогда) */
export function useResetKey(state: ActionState) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state.ok) setKey((k) => k + 1);
  }, [state]);
  return key;
}
