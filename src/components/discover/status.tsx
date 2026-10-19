import { Badge, type Tone } from "@/components/ui/badge";
import {
  applicationState,
  daysUntilDeadline,
  cancelledLabel,
  STATE_LABEL,
  type ApplicationState,
} from "@/domain/announcement";
import { formatLocalDateShort, formatSeoulTime, seoulDateOf } from "@/domain/time";
import type { Announcement } from "@/domain/types";

const STATE_TONE: Record<ApplicationState, Tone> = {
  upcoming: "neutral",
  open: "accent",
  closingSoon: "danger",
  closed: "neutral",
  rolling: "success",
  cancelled: "danger",
};

export function StateBadge({ a, now }: { a: Announcement; now: string }) {
  const state = applicationState(a, now);
  const days = daysUntilDeadline(a, now);
  const label =
    state === "closingSoon" && days !== null
      ? days === 0
        ? "오늘 마감"
        : `마감 D-${days}`
      : state === "cancelled"
        ? cancelledLabel(a)
        : STATE_LABEL[state];
  return <Badge tone={STATE_TONE[state]}>{label}</Badge>;
}

/** 표의 마감일 칸. 날짜·시각을 나란히 정렬하고, 시각이 없으면 없다고 쓴다 */
export function DeadlineCell({ a, now }: { a: Announcement; now: string }) {
  const d = a.applicationDeadline;
  const days = daysUntilDeadline(a, now);
  if (d.type === "rolling" || d.type === "untilBudget" || d.type === "tbd") {
    return (
      <span className="text-sm text-muted">
        {d.type === "rolling" ? "상시 모집" : d.type === "untilBudget" ? "예산 소진 시" : "마감일 미정"}
      </span>
    );
  }
  const date = d.type === "datetime" ? seoulDateOf(d.at) : d.date;
  return (
    <span className="num flex flex-col gap-0.5 leading-tight">
      <span className="text-sm font-semibold text-fg">{formatLocalDateShort(date)}</span>
      <span className="text-xs text-muted">
        {d.type === "datetime" ? formatSeoulTime(d.at) : "시각 미공지"}
        {days !== null && days >= 0 && a.status !== "cancelled" ? ` · ${days === 0 ? "오늘" : `D-${days}`}` : ""}
      </span>
    </span>
  );
}
