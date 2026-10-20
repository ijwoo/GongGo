import { connection } from "next/server";
import type { ReactNode } from "react";
import { LoginGateProvider } from "@/components/auth/login-gate";
import { TopNav } from "@/components/layout/top-nav";
import { ReminderRunner } from "@/components/notifications/reminder-runner";
import { ToastProvider } from "@/components/ui/toast";
import { AppDataProvider } from "@/lib/app-data";
import { isEmailConfigured } from "@/lib/notify/email";
import { loadAnnouncements, type AnnouncementSnapshot } from "@/repositories/announcement-repository";
import { PersonalSync } from "./personal-sync";

/** 요청 시각을 정하고 공고 데이터를 불러와 화면 전체에 내려 준다 */
export async function AppShell({ children }: { children: ReactNode }) {
  // 요청마다 렌더링한다. 프리렌더 중단 신호는 아래 try에서 삼키지 않도록 먼저 기다린다
  await connection();
  let snapshot: AnnouncementSnapshot;
  let loadError = false;
  try {
    snapshot = await loadAnnouncements();
  } catch (error) {
    // 공고를 못 불러와도 헤더·로그인·캘린더 등 다른 기능은 그대로 쓰게 하고, 공고 자리에서만 알린다
    console.error("[announcements] 공고를 불러오지 못했습니다", error);
    snapshot = { announcements: [], now: new Date().toISOString() };
    loadError = true;
  }
  return (
    <AppDataProvider
      serverNow={snapshot.now}
      announcements={snapshot.announcements}
      loadError={loadError}
      emailConfigured={isEmailConfigured()}
      kakaoMapKey={process.env.KAKAO_MAP_JS_KEY?.trim() || null}
    >
      <ToastProvider>
        <PersonalSync />
        <LoginGateProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            본문으로 건너뛰기
          </a>
          <TopNav />
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
      <div className="h-14 border-b border-line bg-panel md:h-[72px]" />
      <div className="mx-auto w-full max-w-[1480px] px-4 pt-10 sm:px-6 lg:px-10">
        <div className="h-9 w-80 max-w-full animate-pulse rounded bg-subtle" />
        <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-subtle" />
        <div className="mt-8 h-12 animate-pulse rounded bg-subtle" />
        <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:mr-[356px]">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <div className="aspect-[16/10] animate-pulse rounded-[10px] bg-subtle" />
              <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-subtle" />
              <div className="mt-2 h-5 w-5/6 animate-pulse rounded bg-subtle" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-subtle" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
