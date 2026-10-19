import type { ReactNode } from "react";
import { LoginGateProvider } from "@/components/auth/login-gate";
import { SummaryStrip } from "@/components/layout/summary-strip";
import { TopNav } from "@/components/layout/top-nav";
import { ReminderRunner } from "@/components/notifications/reminder-runner";
import { ToastProvider } from "@/components/ui/toast";
import { AppDataProvider } from "@/lib/app-data";
import { getRequestNow } from "@/lib/server-clock";
import { isEmailConfigured } from "@/lib/notify/email";
import { getAnnouncementRepository } from "@/repositories/announcement-repository";

/** 요청 시각을 정하고 공고 데이터를 불러와 화면 전체에 내려 준다 */
export async function AppShell({ children }: { children: ReactNode }) {
  const now = await getRequestNow();
  const announcements = await getAnnouncementRepository(now).list();
  return (
    <AppDataProvider serverNow={now} announcements={announcements} emailConfigured={isEmailConfigured()}>
      <ToastProvider>
        <LoginGateProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            본문으로 건너뛰기
          </a>
          <TopNav />
          <SummaryStrip />
          <main id="main" className="min-w-0">
            {children}
          </main>
          <ReminderRunner />
        </LoginGateProvider>
      </ToastProvider>
    </AppDataProvider>
  );
}

export function AppShellFallback() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="h-14 border-b border-line bg-panel" />
      <div className="h-11 border-b border-line bg-panel" />
      <div className="space-y-2 p-4 lg:px-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-sm bg-subtle" />
        ))}
      </div>
    </div>
  );
}
