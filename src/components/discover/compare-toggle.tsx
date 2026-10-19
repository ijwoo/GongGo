"use client";

import { Check, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Announcement } from "@/domain/types";
import { COMPARE_LIMIT, toggleCompare, useCompare, useHydrated } from "@/lib/personal-store";
import { cn } from "@/lib/cn";

function useCompareToggle(a: Announcement) {
  const compare = useCompare();
  const hydrated = useHydrated();
  const toast = useToast();
  const selected = hydrated && compare.includes(a.id);
  const full = !selected && compare.length >= COMPARE_LIMIT;
  const toggle = () => {
    const result = toggleCompare(a.id);
    if (result === "full") toast({ message: `비교는 최대 ${COMPARE_LIMIT}개까지 담을 수 있어요. 다른 공고를 빼고 추가하세요.`, tone: "error" });
    else if (result === "added") toast({ message: `비교에 담았어요 (${compare.length + 1}/${COMPARE_LIMIT})` });
  };
  return { selected, full, toggle };
}

/** 표 안의 비교 선택 체크박스 */
export function CompareCheckbox({ a }: { a: Announcement }) {
  const { selected, full, toggle } = useCompareToggle(a);
  return (
    <label
      className={cn("relative inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-subtle", full && "cursor-not-allowed")}
      title={full ? `비교는 최대 ${COMPARE_LIMIT}개까지` : "비교에 담기"}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        className="peer absolute inset-0 z-[1] size-full cursor-[inherit] opacity-0"
        checked={selected}
        onChange={toggle}
        aria-label={`비교에 담기: ${a.title}`}
        aria-describedby={full ? "compare-full-hint" : undefined}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-flex size-[18px] items-center justify-center rounded-sm border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]",
          selected ? "border-accent bg-accent text-accent-fg" : "border-line-strong bg-panel",
          full && "opacity-40",
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </label>
  );
}

export function CompareButton({ a }: { a: Announcement }) {
  const { selected, toggle } = useCompareToggle(a);
  return (
    <Button onClick={toggle} aria-pressed={selected}>
      <GitCompareArrows className={cn("size-4", selected ? "text-accent" : "text-muted")} aria-hidden />
      {selected ? "비교에 담김" : "비교에 추가"}
    </Button>
  );
}
