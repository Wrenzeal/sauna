"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, ClockCounterClockwise, Flask, GearSix, UsersThree } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { motionDuration, saunaEase } from "@/lib/motion-system";
import { PageTransition } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/lobby", label: "桑拿房", icon: Brain },
  { href: "/studio", label: "蒸馏车间", icon: Flask },
  { href: "/board-meeting", label: "董事会", icon: UsersThree },
  { href: "/settings", label: "模型设置", icon: GearSix },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/lobby" && pathname.startsWith(`${href}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh] text-[var(--sauna-text)]">
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="mx-auto flex h-[68px] max-w-[1460px] items-center gap-3 rounded-[24px] border border-[color:var(--sauna-line)] bg-[color-mix(in_srgb,var(--sauna-panel-strong)_88%,transparent)] px-3 shadow-[var(--sauna-shadow)] backdrop-blur-2xl sm:px-5">
          <Link href="/lobby" className="flex shrink-0 items-center gap-3 rounded-full pr-2 text-[var(--sauna-text)]" aria-label="Sauna 桑拿房">
            <span className="grid size-10 place-items-center rounded-[16px] bg-[var(--sauna-primary)] text-[var(--sauna-primary-contrast)] shadow-[var(--sauna-shadow-soft)]">
              <Brain size={19} weight="duotone" />
            </span>
            <span className="sauna-display hidden text-xl tracking-[-0.04em] sm:block">Sauna</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]" aria-label="主导航">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm transition duration-300 sm:px-4 ${active ? "text-[var(--sauna-text)]" : "text-[var(--sauna-muted)] hover:bg-[var(--sauna-soft)] hover:text-[var(--sauna-text)]"}`}
                >
                  {active ? <motion.span layoutId="top-nav-active" className="absolute inset-0 rounded-full bg-[var(--sauna-soft-strong)]" transition={{ duration: motionDuration.component, ease: saunaEase }} /> : null}
                  <Icon className="relative" size={17} weight={active ? "duotone" : "regular"} />
                  <span className="relative hidden md:inline">{item.label}</span>
                  {active ? <motion.span layoutId="top-nav-line" className="absolute inset-x-4 -bottom-1 h-px bg-[var(--sauna-accent)]" transition={{ duration: motionDuration.component, ease: saunaEase }} /> : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/focus-room/new" className="hidden h-10 items-center gap-2 rounded-full px-4 text-sm text-[var(--sauna-muted)] transition hover:bg-[var(--sauna-soft)] hover:text-[var(--sauna-text)] lg:flex">
              <ClockCounterClockwise size={17} /> 会话
            </Link>
            <ThemeToggle compact />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
