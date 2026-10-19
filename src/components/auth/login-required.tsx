"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/page";
import { Button, buttonClass } from "@/components/ui/button";
import { usePersonal } from "@/hooks/use-personal";
import { useNow } from "@/lib/app-data";
import { startDemoSession } from "@/lib/personal-store";

/** 로그인이 필요한 화면. 비로그인이면 이유를 설명하고 데모 체험을 제안한다 */
export function LoginRequired({ reason, children, fallback }: { reason: string; children: ReactNode; fallback?: ReactNode }) {
  const { hydrated, loggedIn } = usePersonal();
  const now = useNow();
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
      description={
        <>
          {reason}
          <br />
          실제 로그인은 아직 연결되지 않아 데모로 체험할 수 있어요.
        </>
      }
      action={
        <div className="flex gap-2">
          <Link href="/discover" className={buttonClass("secondary")}>
            공고 둘러보기
          </Link>
          <Button variant="primary" onClick={() => startDemoSession(now)}>
            데모로 체험하기
          </Button>
        </div>
      }
    />
  );
}
