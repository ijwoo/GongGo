import { connection } from "next/server";
import type { ReactNode } from "react";
import { LoginGateProvider } from "@/components/auth/login-gate";
import { SummaryStrip } from "@/components/layout/summary-strip";
import { TopNav } from "@/components/layout/top-nav";
import { ReminderRunner } from "@/components/notifications/reminder-runner";
import { ToastProvider } from "@/components/ui/toast";
import { AppDataProvider } from "@/lib/app-data";
import { isEmailConfigured } from "@/lib/notify/email";
import {
  getAnnouncementRepository,
  type AnnouncementSnapshot,
} from "@/repositories/announcement-repository";

/** 요청 시각을 정하고 공고 데이터를 불러와 화면 전체에 내려 준다 */
export async function AppShell({ children }: { children: ReactNode }) {
  // 요청마다 렌더링한다. 프리렌더 중단 신호는 아래 try에서 삼키지 않도록 먼저 기다린다
  await connection();
  let snapshot: AnnouncementSnapshot;
  try {
    snapshot = await getAnnouncementRepository().load();
  } catch (error) {
    console.error("[announcements] 공고를 불러오지 못했습니다", error);
    return <AnnouncementLoadError />;
  }
  return (
    <AppDataProvider
      serverNow={snapshot.now}
      announcements={snapshot.announcements}
      emailConfigured={isEmailConfigured()}
    >
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

/** 백엔드에 연결하지 못했을 때. 다른 화면 기능은 공고 데이터에 기대므로 전체를 대신한다 */
function AnnouncementLoadError() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div
        role="alert"
        className="max-w-md rounded-lg border border-line bg-panel p-6 text-center"
      >
        <p className="text-base font-semibold text-fg">
          공고를 불러오지 못했어요
        </p>
        <p className="mt-2 text-sm text-muted">
          공고 서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.
        </p>
        {/* 서버 컴포넌트라 새로고침 링크로 다시 시도한다 */}
        <a
          href=""
          className="mt-4 inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90"
        >
          다시 시도
        </a>
      </div>
    </main>
  );
}
