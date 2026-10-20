"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { readPersonalState, whenPersonalLoaded } from "@/lib/personal-store";
import { KakaoLoginButton, TestLoginButton } from "./kakao-login-button";

interface Request {
  /** 로그인이 필요한 이유(한 문장) */
  reason: string;
  /** 로그인되어 있을 때 실행할 원래 동작 */
  onAuthorized: () => void;
}

const LoginGateContext = createContext<(req: Request) => void>(() => {});

/**
 * 로그인이 필요한 동작을 감싼다.
 * 로그인 상태면 바로 실행하고, 아니면 이유를 설명하고 카카오 로그인으로 보낸다.
 * 카카오 로그인은 페이지를 떠났다 돌아오므로 원래 동작은 이어서 실행하지 않고, 같은 화면으로 되돌아온다.
 */
export function LoginGateProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<string | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const toast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requireLogin = useCallback((req: Request) => {
    void whenPersonalLoaded().then(() => {
      if (readPersonalState().session) {
        req.onAuthorized();
        return;
      }
      pending.current = req.onAuthorized;
      setReason(req.reason);
    });
  }, []);

  const returnTo = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;

  return (
    <LoginGateContext.Provider value={requireLogin}>
      {children}
      <Sheet
        open={reason !== null}
        onOpenChange={(o) => {
          if (!o) {
            pending.current = null;
            setReason(null);
          }
        }}
        title="로그인이 필요해요"
        description={reason ?? undefined}
      >
        <div className="space-y-3 px-4 py-4 text-sm">
          <p className="text-muted">로그인하면 관심 공고·일정·알림·지원 현황이 계정에 저장돼 어느 기기에서나 이어서 볼 수 있어요.</p>
          <KakaoLoginButton returnTo={returnTo} />
          <TestLoginButton
            onDone={() => {
              const action = pending.current;
              pending.current = null;
              setReason(null);
              toast({ message: "로그인했어요. 하던 작업을 이어서 처리했어요." });
              action?.();
            }}
          />
        </div>
      </Sheet>
    </LoginGateContext.Provider>
  );
}

export function useRequireLogin() {
  return useContext(LoginGateContext);
}
