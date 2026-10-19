import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover active:brightness-95 disabled:bg-line-strong disabled:text-faint",
  secondary:
    "border border-line-strong bg-panel text-fg hover:bg-subtle active:bg-line disabled:text-faint disabled:hover:bg-panel",
  ghost: "text-fg hover:bg-subtle active:bg-line disabled:text-faint disabled:hover:bg-transparent",
  danger: "border border-line-strong bg-panel text-danger hover:bg-danger-soft disabled:text-faint",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1",
  md: "h-10 px-3.5 text-sm gap-1.5",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; ref?: Ref<HTMLButtonElement> }) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/** 아이콘만 있는 버튼. 접근 가능한 이름(label)을 반드시 받는다 */
export function IconButton({
  label,
  className,
  type = "button",
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-fg active:bg-line disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
