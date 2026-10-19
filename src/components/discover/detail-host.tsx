"use client";

import { FileSearch } from "lucide-react";
import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import type { Announcement } from "@/domain/types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { AnnouncementDetail } from "./announcement-detail";

export function DetailEmpty({ missing }: { missing?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center text-[13px] text-muted">
      <FileSearch className="size-6 text-faint" aria-hidden />
      {missing ? (
        <p>
          선택한 공고를 찾을 수 없어요.
          <br />
          삭제되었거나 주소가 잘못되었을 수 있어요.
        </p>
      ) : (
        <p>
          공고를 선택하면
          <br />
          상세 정보가 여기에 표시돼요.
        </p>
      )}
    </div>
  );
}

/**
 * 상세를 어디에 보여 줄지 정한다.
 * - 넓은 화면(breakpoint 이상): 오른쪽 고정 패널
 * - 그보다 좁으면: 태블릿은 오른쪽 서랍, 모바일은 바텀시트
 */
export function DetailHost({
  selected,
  missing,
  onClose,
  panelBreakpoint,
  panelClassName,
  aside,
}: {
  selected: Announcement | null;
  missing: boolean;
  onClose: () => void;
  /** 이 너비 이상에서 고정 패널로 보여 준다 */
  panelBreakpoint: string;
  panelClassName: string;
  aside?: ReactNode;
}) {
  const wide = useMediaQuery(panelBreakpoint);
  const tablet = useMediaQuery("(min-width: 768px)");
  const sheetOpen = !wide && (selected !== null || missing);

  return (
    <>
      <aside aria-label="공고 상세" className={cn("min-h-0 overflow-y-auto border-l border-line bg-panel", panelClassName)}>
        {wide ? selected ? <AnnouncementDetail key={selected.id} a={selected} /> : <DetailEmpty missing={missing} /> : aside}
      </aside>
      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => !o && onClose()}
        side={tablet ? "right" : "bottom"}
        title={selected?.title ?? "공고 상세"}
        hideTitle
      >
        {selected ? <AnnouncementDetail key={selected.id} a={selected} headingLevel={2} /> : <DetailEmpty missing />}
      </Sheet>
    </>
  );
}
