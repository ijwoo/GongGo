"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { ClipboardList, GitCompareArrows, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePersonal } from "@/hooks/use-personal";
import { signOut, useCompare } from "@/lib/personal-store";

export function UserMenu() {
  const { state, hydrated } = usePersonal();
  const router = useRouter();
  const toast = useToast();
  const compare = useCompare();

  if (!hydrated) return <span className="h-8 w-16" aria-hidden />;
  if (!state.session) {
    return (
      <Link href="/login" className={buttonClass("secondary", "md", "ml-1")}>
        로그인
      </Link>
    );
  }
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className="ml-1 flex items-center rounded-full" aria-label="사용자 메뉴">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-base font-bold text-accent-text ring-1 ring-line">
          {state.session.displayName.slice(0, 1)}
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-md border border-line bg-elevated p-1 shadow-[var(--shadow)]">
          <div className="px-2 py-1.5">
            <p className="text-sm font-semibold">{state.session.displayName}</p>
            <p className="text-xs text-muted">카카오 로그인</p>
          </div>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item asChild className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-subtle">
            <Link href="/compare">
              <GitCompareArrows className="size-4 text-muted" aria-hidden />
              공고 비교{compare.length ? <span className="num ml-auto text-xs text-muted">{compare.length}개</span> : null}
            </Link>
          </Menu.Item>
          <Menu.Item asChild className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-subtle">
            <Link href="/applications">
              <ClipboardList className="size-4 text-muted" aria-hidden />
              지원 현황
            </Link>
          </Menu.Item>
          <Menu.Item asChild className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-subtle">
            <Link href="/settings">
              <Settings className="size-4 text-muted" aria-hidden />
              프로필·알림 설정
            </Link>
          </Menu.Item>
          <Menu.Item
            className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-subtle"
            onSelect={() => {
              signOut().then(
                () => {
                  toast({ message: "로그아웃했어요." });
                  router.push("/discover");
                },
                () => toast({ message: "로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.", tone: "error" }),
              );
            }}
          >
            <LogOut className="size-4 text-muted" aria-hidden />
            로그아웃
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
