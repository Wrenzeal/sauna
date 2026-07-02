"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Flask,
  GearSix,
  MagnifyingGlass,
  Plus,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { PageTransition } from "@/components/page-transition";

const navItems = [
  { href: "/lobby", label: "智囊大厅", icon: SquaresFour },
  { href: "/studio", label: "蒸馏车间", icon: Flask },
  { href: "/settings", label: "模型设置", icon: GearSix },
  { href: "/board-meeting", label: "董事会桑拿", icon: UsersThree },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/lobby") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const studioActive = isActivePath(pathname, "/studio");

  return (
    <div className="min-h-[100dvh] text-[#171a1f]">
      <aside className="fixed inset-y-3 left-3 z-50 hidden w-[86px] rounded-[30px] border border-black/[0.07] bg-white/78 p-3 shadow-[0_20px_60px_rgb(27_31_35_/_0.10)] backdrop-blur-2xl lg:flex lg:flex-col lg:items-center">
        <Link
          href="/lobby"
          className="grid size-14 place-items-center rounded-[22px] bg-[#171a1f] text-white shadow-[0_14px_34px_rgb(23_26_31_/_0.24)] transition duration-300 hover:scale-[1.03] hover:shadow-[0_18px_42px_rgb(23_26_31_/_0.28)] active:translate-y-px"
          aria-label="Sauna 桑拿房"
        >
          <Brain size={24} weight="duotone" />
        </Link>
        <nav className="mt-8 flex flex-1 flex-col items-center gap-3" aria-label="主导航">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);
            return (
              <motion.div
                key={item.href}
                className="relative"
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.32, delay: index * 0.035, ease: [0.16, 1, 0.3, 1] }}
              >
                {active && (
                  <motion.span
                    layoutId="dock-active-rail"
                    className="absolute -left-3 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-[#6f8f72] shadow-[0_0_18px_rgb(111_143_114_/_0.55)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Link
                  href={item.href}
                  className={[
                    "group relative grid size-13 place-items-center overflow-hidden rounded-[20px] transition duration-300 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6f8f72]",
                    active
                      ? "bg-[#171a1f] text-white shadow-[0_14px_34px_rgb(23_26_31_/_0.20)]"
                      : "text-[#69717b] hover:bg-[#eef0eb] hover:text-[#171a1f] hover:shadow-[0_10px_26px_rgb(27_31_35_/_0.07)]",
                  ].join(" ")}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_50%_0%,rgb(255_255_255_/_0.35),transparent_58%)]" />
                  <motion.span animate={active && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.55, ease: "easeOut" }}>
                    <Icon size={22} weight="duotone" />
                  </motion.span>
                  {active && <span className="absolute bottom-2 size-1.5 rounded-full bg-[#dfeadc]" />}
                </Link>
              </motion.div>
            );
          })}
        </nav>
        <Link
          href="/studio"
          className={[
            "relative grid size-13 place-items-center overflow-hidden rounded-[20px] text-white transition duration-300 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6f8f72]",
            studioActive
              ? "bg-[#171a1f] shadow-[0_16px_34px_rgb(23_26_31_/_0.24)]"
              : "bg-[#6f8f72] shadow-[0_16px_34px_rgb(68_102_77_/_0.22)] hover:bg-[#5d805f] hover:shadow-[0_18px_40px_rgb(68_102_77_/_0.28)]",
          ].join(" ")}
          aria-label="开始蒸馏"
          aria-current={studioActive ? "page" : undefined}
        >
          {studioActive && <motion.span layoutId="dock-studio-glow" className="absolute inset-1 rounded-[17px] bg-white/10" />}
          <Plus size={22} weight="bold" />
        </Link>
      </aside>

      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#fbfbf8]/78 backdrop-blur-2xl lg:hidden">
        <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <Link href="/lobby" className="flex items-center gap-3 whitespace-nowrap text-sm font-semibold tracking-tight text-[#171a1f]">
            <span className="grid size-10 place-items-center rounded-[18px] bg-[#171a1f] text-white">
              <Brain size={19} weight="duotone" />
            </span>
            Sauna
          </Link>
          <Link
            href="/studio"
            className="h-10 rounded-full bg-[#171a1f] px-5 text-sm font-semibold leading-10 text-white transition duration-300 hover:bg-[#2a2f36] active:translate-y-px"
          >
            开始蒸馏
          </Link>
        </nav>
      </header>

      <div className="lg:pl-[108px]">
        <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-6 lg:px-6 lg:py-6">
          <div className="hidden items-center justify-between gap-4 pb-5 lg:flex">
            <div>
              <p className="text-sm font-medium text-[#68707d]">Sauna 桑拿房</p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#171a1f]">和你的智囊团一起蒸桑拿吧</p>
            </div>
            <div className="flex h-12 min-w-[360px] items-center gap-3 rounded-full border border-black/[0.08] bg-white/72 px-4 shadow-[0_10px_34px_rgb(27_31_35_/_0.07)] backdrop-blur-xl transition duration-300 hover:bg-white/86 hover:shadow-[0_14px_40px_rgb(27_31_35_/_0.09)]">
              <MagnifyingGlass size={18} className="text-[#7a828d]" />
              <span className="text-sm text-[#8b929b]">搜索专家、会话或知识源</span>
            </div>
          </div>
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
    </div>
  );
}
