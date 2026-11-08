// Главное меню. ready=false — модуль запланирован на указанном этапе.
export interface NavItem {
  href: string;
  label: string;
  icon: string; // имя иконки lucide (сопоставляется в Sidebar)
  stage: number;
  ready: boolean;
  ownerOnly?: boolean;
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Бизнес",
    items: [
      { href: "/", label: "Главная", icon: "LayoutDashboard", stage: 1, ready: true },
      { href: "/products", label: "Товары", icon: "Package", stage: 1, ready: true },
      { href: "/calculator", label: "Калькулятор себестоимости", icon: "Calculator", stage: 1, ready: true },
      { href: "/inventory", label: "Склад и закупки", icon: "Warehouse", stage: 2, ready: false },
      { href: "/sales", label: "Продажи и отчёты", icon: "ChartLine", stage: 2, ready: false },
    ],
  },
  {
    title: "Рынок",
    items: [
      { href: "/kaspi", label: "Kaspi Магазин", icon: "Store", stage: 3, ready: false },
      { href: "/competitors", label: "Конкуренты", icon: "Swords", stage: 4, ready: false },
      { href: "/hunter", label: "AI Product Hunter", icon: "Radar", stage: 4, ready: false },
    ],
  },
  {
    title: "Китай",
    items: [
      { href: "/suppliers", label: "Поставщики", icon: "Factory", stage: 5, ready: false },
      { href: "/negotiator", label: "Переговоры (WeChat)", icon: "Languages", stage: 5, ready: false },
    ],
  },
  {
    title: "ИИ и автоматизация",
    items: [
      { href: "/assistant", label: "ИИ-аналитик", icon: "Sparkles", stage: 6, ready: false },
      { href: "/telegram", label: "Telegram-бот", icon: "Send", stage: 7, ready: false },
    ],
  },
  {
    title: "Система",
    items: [
      { href: "/settings", label: "Настройки", icon: "Settings", stage: 1, ready: true },
      { href: "/audit", label: "Журнал операций", icon: "ScrollText", stage: 1, ready: true, ownerOnly: true },
    ],
  },
];
