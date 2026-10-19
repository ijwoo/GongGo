"use client";

import { Star } from "lucide-react";
import { useRequireLogin } from "@/components/auth/login-gate";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Announcement } from "@/domain/types";
import { usePersonal } from "@/hooks/use-personal";
import { useNow } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { isSaved, toggleSaved } from "@/lib/personal-actions";
import { readPersonalState, updatePersonalState } from "@/lib/personal-store";

/** 관심 저장. 행 선택을 일으키지 않도록 클릭 전파를 막는다 */
export function SaveButton({ a, variant = "icon", className }: { a: Announcement; variant?: "icon" | "full"; className?: string }) {
  const { state, hydrated } = usePersonal();
  const requireLogin = useRequireLogin();
  const toast = useToast();
  const now = useNow();
  const saved = hydrated && isSaved(state, a.id);

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireLogin({
      reason: "관심 공고는 계정에 저장돼요. 로그인하면 새로고침해도 유지되고 변경 알림을 받을 수 있어요.",
      onAuthorized: () => {
        const wasSaved = isSaved(readPersonalState(), a.id);
        updatePersonalState((s) => toggleSaved(s, a, now));
        toast({ message: wasSaved ? "관심 공고에서 뺐어요." : "관심 공고에 저장했어요." });
      },
    });
  };

  const label = saved ? `관심 공고에서 빼기: ${a.title}` : `관심 공고에 저장: ${a.title}`;
  if (variant === "full") {
    return (
      <Button variant={saved ? "secondary" : "primary"} onClick={onClick} aria-pressed={saved} aria-label={label} className={className}>
        <Star className={cn("size-4", saved ? "fill-accent text-accent" : "text-accent-fg")} aria-hidden />
        {saved ? "저장됨" : "관심 저장"}
      </Button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "관심 공고에서 빼기" : "관심 공고에 저장"}
      className="inline-flex size-8 items-center justify-center rounded-md text-faint hover:bg-subtle hover:text-fg"
    >
      <Star className={cn("size-[18px]", saved && "fill-accent text-accent")} aria-hidden />
    </button>
  );
}
