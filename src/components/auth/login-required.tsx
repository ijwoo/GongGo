"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/page";
import { buttonClass } from "@/components/ui/button";
import { usePersonal } from "@/hooks/use-personal";
import { KakaoLoginButton, TestLoginButton } from "./kakao-login-button";

/** 로그인이 필요한 화면. 비로그인이면 이유를 설명하고 로그인을 안내한다 */
export function LoginRequired({ reason, children, fallback }: { reason: string; children: ReactNode; fallback?: ReactNode }) {
  const { hydrated, loggedIn } = usePersonal();
  const pathname = usePathname();
  if (!hydrated) {
    return (
      <div aria-busy="true" className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-subtle" />
        ))}
      </div>
    );
  }
  if (loggedIn) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <EmptyState
      icon={<Lock className="size-6 text-faint" aria-hidden />}
      title="로그인이 필요한 화면이에요"
      description={reason}
      action={
        <div className="w-64 space-y-2">
          <KakaoLoginButton returnTo={pathname} />
          <TestLoginButton />
          <Link href="/discover" className={buttonClass("ghost", "md", "w-full")}>
            공고 둘러보기
          </Link>
        </div>
      }
    />
  );
}
