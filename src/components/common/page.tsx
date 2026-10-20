import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * 개인 화면(관심·지원·캘린더·알림·설정)의 폭. 상세 페이지와 같은 1240px에서 멈춰
 * 큰 모니터에서도 표·목록이 끝없이 늘어나지 않는다. 둘러보기만 더 넓은 갤러리 폭을 쓴다
 */
export function PageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1240px] px-4 pt-8 pb-16 sm:px-6 md:pt-10 lg:px-10", className)}>{children}</div>;
}

/** 페이지 제목(28~32px) · 설명 · 오른쪽 동작 */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] md:text-[30px]">{title}</h1>
        {description ? <p className="mt-1.5 text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * 목록 보기 전환(전체·변경 있음, 상태별 등). 밑줄 탭 하나로 통일하고 개수를 함께 쓴다
 */
export function ViewTabs<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("mb-5 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap",
              active ? "border-accent font-semibold text-fg" : "border-transparent font-medium text-muted hover:text-fg",
            )}
          >
            {t.label}
            {t.count !== undefined ? " " : null}
            {t.count !== undefined ? <span className={cn("num text-[13px]", active ? "text-accent-text" : "text-muted")}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-subtle px-6 py-14 text-center">
      {icon}
      <div>
        <p className="font-semibold">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
