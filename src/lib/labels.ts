export const STATUS_LABEL = { IDEA: "Идея", ACTIVE: "Продаётся", PAUSED: "Пауза", ARCHIVED: "Архив" } as const;
export const STATUS_VARIANT = { IDEA: "default", ACTIVE: "success", PAUSED: "warning", ARCHIVED: "muted" } as const;

export const ORDER_STATUS_LABEL = { NEW: "Новый", COMPLETED: "Выполнен", CANCELLED: "Отменён", RETURNED: "Возврат" } as const;
export const ORDER_STATUS_VARIANT = { NEW: "default", COMPLETED: "success", CANCELLED: "muted", RETURNED: "warning" } as const;
export const ORDER_SOURCE_LABEL = { MANUAL: "Вручную", IMPORT: "Импорт", KASPI_API: "Kaspi API" } as const;
export const MOVEMENT_LABEL = {
  IN: "Приход",
  OUT: "Продажа",
  RESERVE: "Резерв",
  UNRESERVE: "Снятие резерва",
  RETURN: "Возврат",
  ADJUST: "Инвентаризация",
} as const;
export const EXPENSE_LABEL = {
  ADS: "Реклама",
  SALARY: "Зарплата",
  RENT: "Аренда",
  TAXES: "Налоги",
  SERVICES: "Сервисы и связь",
  OTHER: "Прочее",
} as const;
