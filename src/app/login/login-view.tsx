"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KakaoLoginButton, TestLoginButton } from "@/components/auth/kakao-login-button";
import { buttonClass } from "@/components/ui/button";
import { usePersonal } from "@/hooks/use-personal";
import { safeReturnTo } from "@/lib/personal-store";

export function LoginView() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeReturnTo(params.get("next"));
  const failed = params.get("error") !== null;
  const { loggedIn, hydrated, state } = usePersonal();

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold">공고함 로그인</h1>
      <p className="mt-1 text-[13px] text-muted">관심 공고, 내 캘린더, 알림, 지원 현황은 로그인 후 쓸 수 있어요.</p>

      <div className="mt-6 rounded-lg border border-line bg-panel p-5">
        {failed ? (
          <p role="alert" className="mb-4 flex gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            카카오 로그인을 마치지 못했어요. 다시 시도해 주세요.
          </p>
        ) : null}

        <ul className="space-y-1.5 text-[13px]">
          {["카카오 계정으로 로그인해요. 비밀번호를 받지 않아요", "닉네임만 받아요. 이메일·전화번호는 받지 않아요", "설정에서 언제든 탈퇴하고 모든 데이터를 지울 수 있어요"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
              {t}
            </li>
          ))}
        </ul>

        {hydrated && loggedIn ? (
          <div className="mt-5 space-y-2">
            <p className="text-[13px] font-semibold">{state.session?.displayName}님으로 로그인되어 있어요.</p>
            <Link href={next} className={buttonClass("primary", "md", "w-full")}>
              이전 화면으로 돌아가기
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            <KakaoLoginButton returnTo={next} />
            <TestLoginButton onDone={() => router.replace(next)} />
          </div>
        )}
      </div>
    </div>
  );
}
