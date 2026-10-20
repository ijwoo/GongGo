"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { ensurePersonalLoaded, onSyncError } from "@/lib/personal-store";

/** 개인 데이터를 한 번 불러오고, 서버 저장이 실패하면 알려 준다 */
export function PersonalSync() {
  const toast = useToast();
  useEffect(() => {
    ensurePersonalLoaded();
    return onSyncError((message) => toast({ message, tone: "error" }));
  }, [toast]);
  return null;
}
