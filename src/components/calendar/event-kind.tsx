import { EVENT_KIND_LABEL } from "@/domain/calendar";
import type { EventKind } from "@/domain/types";
import { cn } from "@/lib/cn";

/** 일정 종류는 색과 글자를 함께 쓴다 */
export const KIND_SHORT: Record<EventKind, string> = { deadline: "마감", event: "행사", prep: "준비" };

const KIND_STYLE: Record<EventKind, string> = {
  deadline: "bg-danger-soft text-danger",
  event: "bg-accent-soft text-accent-text",
  prep: "bg-success-soft text-success",
};

export function KindTag({ kind, className }: { kind: EventKind; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-sm px-1 text-[11px] font-bold", KIND_STYLE[kind], className)} title={EVENT_KIND_LABEL[kind]}>
      {KIND_SHORT[kind]}
    </span>
  );
}
