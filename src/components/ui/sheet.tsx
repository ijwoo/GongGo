"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Side = "center" | "right" | "bottom";

const CONTENT: Record<Side, string> = {
  center:
    "left-1/2 top-1/2 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg max-h-[calc(100dvh-48px)]",
  right: "right-0 top-0 h-dvh w-[min(440px,100vw)] border-l border-line",
  bottom: "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-lg",
};

/**
 * 대화상자·서랍·바텀시트. Radix Dialog가 포커스 가두기, Escape 닫기, 배경 스크롤 잠금을 처리한다.
 */
export function Sheet({
  open,
  onOpenChange,
  side = "center",
  title,
  description,
  children,
  footer,
  hideTitle,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: Side;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  hideTitle?: boolean;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className={cn("fixed z-50 flex flex-col bg-elevated shadow-[var(--shadow)] outline-none", CONTENT[side], className)}
        >
          <div
            className={cn(
              "flex shrink-0 items-start gap-3",
              hideTitle ? "absolute top-2 right-2 z-10" : "border-b border-line px-4 py-3",
            )}
          >
            <div className={cn("min-w-0 flex-1", hideTitle && "sr-only")}>
              <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-[13px] text-muted">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close
              aria-label="닫기"
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg",
                hideTitle ? "bg-panel/90" : "-mr-1",
              )}
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          {!description ? <Dialog.Description className="sr-only">{title}</Dialog.Description> : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[inherit]">{children}</div>
          {footer ? <div className="shrink-0 border-t border-line px-4 py-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
