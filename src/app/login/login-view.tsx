"use client";

import { CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, buttonClass } from "@/components/ui/button";
import { usePersonal } from "@/hooks/use-personal";
import { useNow } from "@/lib/app-data";
import { startDemoSession } from "@/lib/personal-store";

/** 같은 사이트 안의 경로만 돌아갈 곳으로 허용한다(외부 주소로 보내는 열린 리다이렉트 방지) */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/discover";
  return value;
}

export function LoginView() {
  const params = useSearchParams();
  const router = useRouter();
  const now = useNow();
  const next = safeNext(params.get("next"));
  const { loggedIn, hydrated } = usePersonal();

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold">공고함 로그인</h1>
      <p className="mt-1 text-[13px] text-muted">관심 공고, 내 캘린더, 알림, 지원 현황은 로그인 후 쓸 수 있어요.</p>

      <div className="mt-6 rounded-lg border border-line bg-panel p-5">
        <div className="flex gap-2 rounded-md bg-subtle px-3 py-2.5 text-[13px]">
          <Info className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <p>
            실제 계정 로그인(OAuth 등)은 아직 연결되지 않았어요. 연결 방법은 README의 ‘인증 연결’을 참고하세요. 지금은 합성 프로필로
            체험할 수 있어요.
          </p>
        </div>

        <ul className="mt-4 space-y-1.5 text-[13px]">
          {["비밀번호를 받거나 저장하지 않아요", "체험 데이터는 이 브라우저에만 저장돼요", "설정에서 언제든 초기화할 수 있어요"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              {t}
            </li>
          ))}
        </ul>

        {hydrated && loggedIn ? (
          <div className="mt-5 space-y-2">
            <p className="text-[13px] font-semibold">이미 데모 체험 중이에요.</p>
            <Link href={next} className={buttonClass("primary", "md", "w-full")}>
              이전 화면으로 돌아가기
            </Link>
          </div>
        ) : (
          <Button
            variant="primary"
            className="mt-5 w-full"
            disabled={!hydrated}
            onClick={() => {
              startDemoSession(now);
              router.replace(next);
            }}
          >
            데모로 체험하기
          </Button>
        )}
      </div>
    </div>
  );
}
