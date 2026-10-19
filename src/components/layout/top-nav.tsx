"use client";

import { Bell, Menu as MenuIcon, Search } from "lucide-react";
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
  return [
    { href: discoverHref, match: "/discover", label: "발견" },
    { href: "/saved", match: "/saved", label: "관심 공고" },
    { href: "/compare", match: "/compare", label: "공고 비교", count: compare.length },
    { href: "/calendar", match: "/calendar", label: "내 캘린더" },
    { href: "/applications", match: "/applications", label: "지원 현황" },
  ];
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
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        id="global-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="공고명, 기관, 지역 검색"
        className="h-9 w-full rounded-md border border-line bg-subtle pr-3 pl-8 text-sm placeholder:text-faint focus:border-accent focus:bg-panel focus:outline-none"
      />
    </form>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const items = useNavItems();
  const { state, loggedIn } = usePersonal();
  const unread = loggedIn ? state.notifications.filter((n) => !n.read).length : 0;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4 lg:gap-5">
        <Logo />
        <nav aria-label="주요 메뉴" className="hidden h-full items-stretch md:flex">
          {items.map((item) => {
            const active = pathname.startsWith(item.match);
            return (
              <Link
                key={item.match}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1 px-2.5 text-[15px] font-semibold whitespace-nowrap transition-colors lg:px-3",
                  active ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {item.label}
                {item.count ? (
                  <span className="num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-fg">
                    <span className="sr-only">선택 </span>
                    {item.count}
                    <span className="sr-only">개</span>
                  </span>
                ) : null}
                {active ? <span className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-full bg-fg lg:inset-x-3" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>
        <SearchBox className="ml-auto hidden w-full max-w-72 sm:block" />
        <div className="ml-auto flex items-center gap-0.5 sm:ml-0">
          <Link
            href="/notifications"
            className="relative inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg"
            aria-label={unread ? `알림, 읽지 않은 알림 ${unread}개` : "알림"}
          >
            <Bell className="size-[18px]" aria-hidden />
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
          <nav aria-label="주요 메뉴">
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.match}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={pathname.startsWith(item.match) ? "page" : undefined}
                    className="flex h-12 items-center justify-between text-base font-semibold aria-[current=page]:text-accent-text"
                  >
                    {item.label}
                    {item.count ? <span className="num text-sm text-muted">{item.count}개 선택</span> : null}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex h-12 items-center text-base font-semibold">
                  프로필·알림 설정
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </Sheet>
    </header>
  );
}
