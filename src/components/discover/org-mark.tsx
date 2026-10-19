import type { Announcement } from "@/domain/types";
import { cn } from "@/lib/cn";

/** 기관 이미지 대신 쓰는 단색 아이콘(기관명 첫 글자) */
export function OrgMark({ org, size = "md" }: { org: Announcement["organizer"]; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white",
        size === "sm" ? "size-6 text-[11px]" : "size-9 text-sm",
      )}
      style={{ backgroundColor: org.color }}
    >
      {org.name.slice(0, 1)}
    </span>
  );
}
