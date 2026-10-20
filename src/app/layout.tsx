import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import { AppShell, AppShellFallback } from "./app-shell";

export const metadata: Metadata = {
  title: { default: "공고함", template: "%s · 공고함" },
  description: "해커톤·창업 지원사업·교육·개발자 행사 공고를 비교하고 지원 일정을 관리하는 서비스",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17181d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page text-fg antialiased">
        <Suspense fallback={<AppShellFallback />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
