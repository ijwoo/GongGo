"use client";

import { useState } from "react";
import { CATEGORY_LABEL } from "@/domain/announcement";
import { posterVariant } from "@/domain/card";
import type { Announcement } from "@/domain/types";
import { cn } from "@/lib/cn";

/**
 * 공고 표지. 출처가 이미지를 주면 그것을 쓰고(포스터는 잘리지 않게 contain),
 * 없거나 불러오지 못하면 제목·기관·분야로 만든 자체 표지를 쓴다.
 * 자체 표지는 실제 기관이 만든 공식 포스터처럼 보이지 않도록 사진·로고 없이 단색과 글자·단순 도형만 쓴다.
 * 템플릿은 공고 id로 정해져 렌더링마다 바뀌지 않는다. 색은 globals.css의 --poster-* 토큰.
 */
export function Poster({ a, className, variant = "card" }: { a: Announcement; className?: string; variant?: "card" | "detail" }) {
  const [failed, setFailed] = useState(false);
  const image = a.image && !failed ? a.image : null;
  const contain = image?.kind === "poster";
  return (
    <div
      className={cn(
        "relative aspect-[16/10] w-full overflow-hidden bg-subtle",
        variant === "detail" ? "rounded-xl" : "rounded-[10px]",
        className,
      )}
    >
      {image ? (
        <>
          {contain ? (
            // 포스터는 글자가 잘리지 않게 contain으로 두고, 남는 여백은 같은 이미지를 흐리게 깔아 채운다
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt=""
              aria-hidden
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl"
            />
          ) : null}
          {/* 출처 이미지는 크기를 모르는 외부 주소라 next/image 대신 img를 쓰고, 고정 비율 상자로 레이아웃 이동을 막는다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.alt ?? ""}
            loading={variant === "detail" ? "eager" : "lazy"}
            decoding="async"
            // 일부 사이트는 다른 출처의 이미지 요청을 막으므로 출처 정보를 보내지 않는다
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className={cn("absolute inset-0 size-full", contain ? "object-contain" : "object-cover")}
          />
        </>
      ) : (
        <GeneratedPoster a={a} />
      )}
    </div>
  );
}

function GeneratedPoster({ a }: { a: Announcement }) {
  const v = posterVariant(a.id) + 1;
  const style = {
    "--p-bg": `var(--poster-${v}-bg)`,
    "--p-fg": `var(--poster-${v}-fg)`,
    "--p-shape": `var(--poster-${v}-shape)`,
  } as React.CSSProperties;
  return (
    <div aria-hidden className="absolute inset-0 bg-[var(--p-bg)] text-[var(--p-fg)] [container-type:inline-size]" style={style}>
      <Shape variant={v} />
      <div className="relative flex h-full flex-col justify-between p-[6.5cqw]">
        <p className="text-[max(11px,3.6cqw)] font-semibold opacity-80">{CATEGORY_LABEL[a.category]}</p>
        <div className="min-w-0 max-w-[88%]">
          <p className="line-clamp-3 text-[max(15px,7.2cqw)] leading-[1.18] font-extrabold tracking-[-0.02em] break-keep">{a.title}</p>
          <p className="mt-[2.4cqw] truncate text-[max(11px,3.4cqw)] font-medium opacity-75">{a.organizer.name}</p>
        </div>
      </div>
    </div>
  );
}

/** 템플릿마다 하나의 단순한 도형. 제목이 놓이는 아래쪽 60%를 가리지 않도록 위쪽 40% 안의 오른쪽에만 그린다 */
function Shape({ variant }: { variant: number }) {
  const fill = "var(--p-shape)";
  switch (variant) {
    case 1:
      return (
        <svg className="absolute -top-[38%] -right-[6%] h-[78%]" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill="none" stroke={fill} strokeWidth="9" />
        </svg>
      );
    case 2:
      return (
        <svg className="absolute top-0 right-[17%] h-[40%]" viewBox="0 0 100 100" preserveAspectRatio="xMaxYMin meet">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={20 + i * 20} y="0" width="10" height={40 + i * 20} fill={fill} />
          ))}
        </svg>
      );
    case 3:
      return (
        <svg className="absolute top-0 right-0 h-[42%]" viewBox="0 0 100 100" preserveAspectRatio="xMaxYMin meet">
          <path d="M100 0 L100 100 L20 0 Z" fill={fill} />
        </svg>
      );
    case 4:
      return (
        <svg className="absolute top-[9%] right-[17%] h-[30%]" viewBox="0 0 100 100">
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={c * 36} y={r * 36} width="26" height="26" rx="3" fill={fill} opacity={(r + c) % 2 ? 0.55 : 1} />))}
        </svg>
      );
    default:
      return (
        <svg className="absolute -top-[56%] -right-[8%] h-[96%]" viewBox="0 0 100 100">
          {[46, 34, 22].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={fill} strokeWidth="4" />
          ))}
        </svg>
      );
  }
}
