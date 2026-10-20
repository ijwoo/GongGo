"use client";

import { Bell, GitCompareArrows, Menu as MenuIcon, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { usePersonal } from "@/hooks/use-personal";
import { cn } from "@/lib/cn";
import { useDiscoverHref } from "@/lib/last-discover";
import { useCompare } from "@/lib/personal-store";
import { Logo } from "./logo";
import { ThemeMenu } from "./theme-menu";
import { UserMenu } from "./user-menu";

function useNavItems() {
  const discoverHref = useDiscoverHref();
  const compare = useCompare();
  return {
    /** 헤더에 보이는 주요 메뉴 */
    primary: [
      { href: discoverHref, match: ["/discover", "/announcements"], label: "둘러보기" },
      { href: "/saved", match: ["/saved"], label: "관심 공고" },
      { href: "/calendar", match: ["/calendar"], label: "내 캘린더" },
    ],
    /** 사용자 메뉴·모바일 메뉴에서 여는 화면 */
    secondary: [
      { href: "/compare", match: ["/compare"], label: "공고 비교", count: compare.length },
      { href: "/applications", match: ["/applications"], label: "지원 현황" },
      { href: "/notifications", match: ["/notifications"], label: "알림" },
      { href: "/settings", match: ["/settings"], label: "프로필·알림 설정" },
    ],
    compareCount: compare.length,
  };
}

function isActive(pathname: string, match: string[]) {
  return match.some((m) => pathname.startsWith(m));
}

function SearchBox({ className, onDone }: { className?: string; onDone?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/discover" ? (params.get("q") ?? "") : "";
  const [value, setValue] = useState(current);
  const [synced, setSynced] = useState(current);
  if (current !== synced) {
    // 다른 곳(필터 초기화, 뒤로 가기)에서 검색어가 바뀌면 입력값을 맞춘다
    setSynced(current);
    setValue(current);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(pathname === "/discover" ? params : undefined);
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    next.delete("id");
    router.push(`/discover${next.size ? `?${next}` : ""}`);
    onDone?.();
  };

  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)}>
      <label htmlFor="global-search" className="sr-only">
        공고 검색
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
      <input
        id="global-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="공고명·주최기관 검색"
        className="h-11 w-full rounded-lg border border-line bg-panel pr-3 pl-10 text-[15px] placeholder:text-faint focus:border-accent focus:outline-none"
      />
    </form>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { primary, secondary, compareCount } = useNavItems();
  const { state, loggedIn } = usePersonal();
  const unread = loggedIn ? state.notifications.filter((n) => !n.read).length : 0;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel">
      <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center gap-3 px-4 sm:px-6 md:h-[72px] lg:gap-8 lg:px-10">
        <Logo />
        <nav aria-label="주요 메뉴" className="hidden h-full items-stretch gap-1 md:flex lg:ml-6">
          {primary.map((item) => {
            const active = isActive(pathname, item.match);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center px-3 text-base whitespace-nowrap transition-colors lg:px-4",
                  active ? "font-semibold text-accent-text" : "font-medium text-fg-2 hover:text-fg",
                )}
              >
                {item.label}
                {active ? <span className="absolute inset-x-3 bottom-0 h-[2px] bg-accent lg:inset-x-4" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>
        <SearchBox className="ml-auto hidden w-full max-w-[300px] lg:block" />
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {compareCount ? (
            <Link
              href="/compare"
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-line px-2.5 text-sm font-medium text-fg-2 hover:bg-hover md:inline-flex"
              aria-label={`공고 비교, ${compareCount}개 선택`}
            >
              <GitCompareArrows className="size-4 text-muted" aria-hidden />
              비교 <span className="num font-semibold text-accent-text">{compareCount}</span>
            </Link>
          ) : null}
          <IconButton label="검색" className="lg:hidden" onClick={() => setMenuOpen(true)}>
            <Search className="size-5" aria-hidden />
          </IconButton>
          <Link
            href="/notifications"
            className="relative inline-flex size-10 items-center justify-center rounded-lg text-fg-2 hover:bg-hover hover:text-fg"
            aria-label={unread ? `알림, 읽지 않은 알림 ${unread}개` : "알림"}
          >
            <Bell className="size-[22px]" strokeWidth={1.8} aria-hidden />
            {unread ? (
              <span className="num absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          <ThemeMenu />
          <UserMenu />
          <IconButton label="메뉴 열기" className="md:hidden" onClick={() => setMenuOpen(true)}>
            <MenuIcon className="size-5" aria-hidden />
          </IconButton>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} side="right" title="메뉴">
        <div className="space-y-4 p-4">
          <SearchBox onDone={() => setMenuOpen(false)} />
          <nav aria-label="전체 메뉴">
            <ul className="divide-y divide-line">
              {[...primary, ...secondary].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(pathname, item.match) ? "page" : undefined}
                    className="flex h-12 items-center justify-between text-base font-semibold aria-[current=page]:text-accent-text"
                  >
                    {item.label}
                    {"count" in item && typeof item.count === "number" && item.count > 0 ? (
                      <span className="num text-sm text-muted">{item.count}개 선택</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Sheet>
    </header>
  );
}
