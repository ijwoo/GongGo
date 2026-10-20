"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { takeReturnTo } from "@/lib/personal-store";

/** 카카오 로그인이 끝나면 서버가 이 화면으로 보낸다. 로그인 전에 있던 화면으로 되돌려 보낸다 */
export function LoginComplete() {
  const router = useRouter();
  useEffect(() => {
    router.replace(takeReturnTo());
  }, [router]);
  return (
    <p role="status" className="px-4 py-10 text-center text-sm text-muted">
      로그인했어요. 이전 화면으로 돌아가는 중…
    </p>
  );
}
