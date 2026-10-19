import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** 발견 화면과 같은 좌우 여백으로 화면 폭을 모두 쓴다. 넓은 공간은 각 화면이 열을 나눠 활용한다 */
export function PageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full px-4 py-6 md:py-7 lg:px-6", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong bg-panel px-6 py-14 text-center">
      {icon}
      <div>
        <p className="font-semibold">{title}</p>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
