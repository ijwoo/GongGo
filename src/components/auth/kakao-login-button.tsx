"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { startKakaoLogin, testLogin, useAuthConfig } from "@/lib/personal-store";

/** 카카오 공식 버튼 색(#FEE500)과 글자색(85% 검정)을 쓴다 */
export function KakaoLoginButton({ returnTo, className }: { returnTo: string; className?: string }) {
  const { kakaoEnabled } = useAuthConfig();
  return (
    <div className={cn("space-y-1.5", className)}>
      <button
        type="button"
        disabled={!kakaoEnabled}
        onClick={() => startKakaoLogin(returnTo)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] text-sm font-semibold text-black/85 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <KakaoSymbol />
        카카오로 로그인
      </button>
      {!kakaoEnabled ? <p className="text-xs text-warning">카카오 로그인이 아직 설정되지 않았어요(서버의 KAKAO_REST_API_KEY).</p> : null}
    </div>
  );
}

/** 테스트 전용 로그인. 서버가 켜 둔 경우(E2E·로컬)에만 보인다 */
export function TestLoginButton({ onDone }: { onDone?: () => void }) {
  const { testLoginEnabled } = useAuthConfig();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!testLoginEnabled) return null;
  return (
    <Button
      className="w-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await testLogin(`테스트-${crypto.randomUUID().slice(0, 8)}`);
          onDone?.();
        } catch {
          toast({ message: "테스트 로그인에 실패했어요.", tone: "error" });
        } finally {
          setBusy(false);
        }
      }}
    >
      테스트 계정으로 로그인
    </Button>
  );
}

function KakaoSymbol() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.21 4.66 6.59l-.95 3.48c-.08.3.26.54.52.37l4.15-2.74c.53.06 1.07.09 1.62.09 5.52 0 10-3.48 10-7.79S17.52 3 12 3z"
      />
    </svg>
  );
}
