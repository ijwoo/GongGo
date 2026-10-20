import Link from "next/link";

/** 공고함 워드마크. 겹친 서류 모양의 단순한 도형 */
export function Logo() {
  return (
    <Link href="/discover" className="flex shrink-0 items-center gap-2.5 rounded-md font-bold text-fg" aria-label="공고함 홈">
      <svg viewBox="0 0 20 20" className="size-7" aria-hidden>
        <rect x="2" y="5" width="13" height="13" rx="2" fill="var(--accent)" opacity="0.35" />
        <rect x="5" y="2" width="13" height="13" rx="2" fill="var(--accent)" />
        <path d="M8.5 7h6M8.5 10h4" stroke="var(--accent-fg)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="text-[22px] tracking-tight">공고함</span>
    </Link>
  );
}
