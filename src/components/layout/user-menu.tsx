"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { usePersonal } from "@/hooks/use-personal";
import { signOut } from "@/lib/personal-store";

export function UserMenu() {
  const { state, hydrated } = usePersonal();
  const router = useRouter();
  const toast = useToast();

  if (!hydrated) return <span className="h-8 w-16" aria-hidden />;
  if (!state.session) {
    return (
      <Link href="/login" className={buttonClass("secondary", "sm")}>
        로그인
      </Link>
    );
  }
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold hover:bg-subtle" aria-label="사용자 메뉴">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <UserRound className="size-3.5" aria-hidden />
        </span>
        <span className="hidden lg:inline">{state.session.displayName}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-md border border-line bg-elevated p-1 shadow-[var(--shadow)]">
          <div className="px-2 py-1.5">
            <p className="text-sm font-semibold">{state.session.displayName}</p>
            <p className="text-xs text-muted">카카오 로그인</p>
          </div>
          <Menu.Separator className="my-1 h-px bg-line" />
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
