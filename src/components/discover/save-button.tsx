"use client";

import { Bookmark } from "lucide-react";
import { useRequireLogin } from "@/components/auth/login-gate";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Announcement } from "@/domain/types";
import { usePersonal } from "@/hooks/use-personal";
import { useNow } from "@/lib/app-data";
import { cn } from "@/lib/cn";
import { isSaved, toggleSaved } from "@/lib/personal-actions";
import { readPersonalState, updatePersonalState } from "@/lib/personal-store";

/** 관심 저장. 카드·행 선택을 일으키지 않도록 클릭 전파를 막는다 */
export function SaveButton({
  a,
  variant = "icon",
  className,
}: {
  a: Announcement;
  /** overlay: 표지 위에 얹는 작은 버튼(밝은·어두운 표지 모두에서 보이도록 흰 바탕) */
  variant?: "icon" | "full" | "overlay";
  className?: string;
}) {
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
        <Bookmark className={cn("size-4", saved ? "fill-accent text-accent" : "text-accent-fg")} aria-hidden />
        {saved ? "저장됨" : "관심 저장"}
      </Button>
    );
  }
  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        title={saved ? "관심 공고에서 빼기" : "관심 공고에 저장"}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-lg bg-white/95 text-[#202622] shadow-[0_1px_3px_rgb(0_0_0/0.18)] ring-1 ring-black/5 transition-colors hover:bg-white",
          className,
        )}
      >
        <Bookmark className={cn("size-[18px]", saved && "fill-[#205d47] text-[#205d47]")} aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "관심 공고에서 빼기" : "관심 공고에 저장"}
      className={cn("inline-flex size-8 items-center justify-center rounded-md text-faint hover:bg-subtle hover:text-fg", className)}
    >
      <Bookmark className={cn("size-[18px]", saved && "fill-accent text-accent")} aria-hidden />
    </button>
  );
}
