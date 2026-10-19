"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "라이트", icon: Sun },
  { value: "dark", label: "다크", icon: Moon },
  { value: "system", label: "시스템 설정", icon: Monitor },
];

export function ThemeMenu() {
  const pref = useThemePreference();
  const current = OPTIONS.find((o) => o.value === pref)!;
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={`화면 테마: ${current.label}`}
        title="화면 테마"
        className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-fg"
      >
        <Sun className="size-[18px] dark:hidden" aria-hidden />
        <Moon className="hidden size-[18px] dark:block" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="z-50 min-w-40 rounded-md border border-line bg-elevated p-1 shadow-[var(--shadow)]">
          <Menu.Label className="px-2 py-1.5 text-xs text-muted">화면 테마</Menu.Label>
          <Menu.RadioGroup value={pref} onValueChange={(v) => setThemePreference(v as ThemePreference)}>
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <Menu.RadioItem
                key={value}
                value={value}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm outline-none data-[highlighted]:bg-subtle"
              >
                <Icon className="size-4 text-muted" aria-hidden />
                <span className="flex-1">{label}</span>
                <Menu.ItemIndicator>
                  <Check className="size-4 text-accent" aria-hidden />
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
