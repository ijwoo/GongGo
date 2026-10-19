"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useNow } from "@/lib/app-data";
import { readPersonalState, startDemoSession } from "@/lib/personal-store";

interface Request {
  /** 로그인이 필요한 이유(한 문장) */
  reason: string;
  /** 로그인 직후 이어서 실행할 원래 동작 */
  onAuthorized: () => void;
}

const LoginGateContext = createContext<(req: Request) => void>(() => {});

/**
 * 로그인이 필요한 동작을 감싼다.
 * 이미 로그인(데모) 상태면 바로 실행하고, 아니면 이유를 설명한 뒤 데모 체험을 시작하고 원래 동작을 이어서 실행한다.
 */
export function LoginGateProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<string | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const now = useNow();
  const toast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requireLogin = useCallback((req: Request) => {
    if (readPersonalState().session) {
      req.onAuthorized();
      return;
    }
    pending.current = req.onAuthorized;
    setReason(req.reason);
  }, []);

  const startDemo = () => {
    startDemoSession(now);
    const action = pending.current;
    pending.current = null;
    setReason(null);
    toast({ message: "데모 체험을 시작했어요. 하던 작업을 이어서 처리했어요." });
    action?.();
  };

  const next = `${pathname}${searchParams.size ? `?${searchParams}` : ""}`;

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
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonClass("ghost", "md")} onClick={() => setReason(null)}>
              로그인 화면으로
            </Link>
            <Button variant="primary" onClick={startDemo}>
              <LogIn className="size-4" aria-hidden />
              데모로 체험하기
            </Button>
          </div>
        }
      >
        <div className="space-y-2 px-4 py-4 text-sm text-muted">
          <p>
            실제 계정 로그인은 아직 연결되지 않았어요. 데모로 체험하면 합성 프로필로 관심 저장, 캘린더, 알림, 지원 현황을 모두
            써 볼 수 있어요.
          </p>
          <p>데모 데이터는 이 브라우저에만 저장되고, 설정에서 언제든 초기화할 수 있어요.</p>
        </div>
      </Sheet>
    </LoginGateContext.Provider>
  );
}

export function useRequireLogin() {
  return useContext(LoginGateContext);
}
