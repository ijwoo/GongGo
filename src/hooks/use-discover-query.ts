"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseDiscoverQuery, serializeDiscoverQuery, type DiscoverQuery } from "@/domain/discover";

/**
 * 발견 화면의 탐색 상태 ↔ URL query.
 * - 필터·정렬·뷰 변경은 history에 쌓아(push) 뒤로 가기로 되돌릴 수 있게 한다.
 * - 공고 선택과 검색어 입력 중간 값은 replace로 바꿔 history를 어지럽히지 않는다.
 */
export function useDiscoverQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = useMemo(() => parseDiscoverQuery(new URLSearchParams(params.toString())), [params]);

  const hrefFor = useCallback(
    (patch: Partial<DiscoverQuery>) => {
      const qs = serializeDiscoverQuery({ ...query, ...patch });
      return `${pathname}${qs ? `?${qs}` : ""}`;
    },
    [pathname, query],
  );

  const setQuery = useCallback(
    (patch: Partial<DiscoverQuery>, mode: "push" | "replace" = "push") => {
      const href = hrefFor(patch);
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [hrefFor, router],
  );

  return { query, setQuery, hrefFor };
}
