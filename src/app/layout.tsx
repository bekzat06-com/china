import type { Metadata } from "next";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ILYAS AI COMMERCE", template: "%s · ILYAS AI COMMERCE" },
  description: "ИИ-аналитик для товарного бизнеса на Kaspi: прибыль, себестоимость, склад, поставщики из Китая",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
