import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "@/app/actions/auth";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const ROLE_LABEL = { OWNER: "Владелец", MANAGER: "Менеджер", VIEWER: "Просмотр" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isOwner = user.role === "OWNER";
  return (
    <div className="flex min-h-screen">
      <Sidebar isOwner={isOwner} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <MobileNav isOwner={isOwner} />
          <p className="text-sm text-muted-foreground lg:hidden">ILYAS AI</p>
          <div className="ml-auto flex items-center gap-1">
            <div className="mr-2 hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[user.role]}</p>
            </div>
            <ThemeToggle />
            <form action={logoutAction}>
              <Button variant="ghost" size="icon" aria-label="Выйти" title="Выйти">
                <LogOut />
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
