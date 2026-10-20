"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LoginRequired } from "@/components/auth/login-required";
import { PageFrame, PageHeader } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL } from "@/domain/announcement";
import { CAREER_BUCKETS, CATEGORIES, REGIONS, userProfileSchema, type ChangeAlertPrefs, type UserProfile } from "@/domain/types";
import { usePersonal } from "@/hooks/use-personal";
import { deleteAccount, signOut } from "@/lib/personal-store";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme";

const CAREER_LABEL: Record<(typeof CAREER_BUCKETS)[number], string> = {
  student: "학생",
  "0-2": "0~2년",
  "3-5": "3~5년",
  "6+": "6년 이상",
};

const ALERT_LABEL: Record<keyof ChangeAlertPrefs, string> = {
  deadline: "마감 변경",
  venue: "장소 변경",
  conditions: "조건·서류 변경",
  cancel: "공고 취소",
};

function Card({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="rounded-lg border border-line bg-panel p-4 md:p-5">
      <h2 id={`${id}-title`} className="text-base font-bold">
        {title}
      </h2>
      {description ? <p className="mt-0.5 mb-4 text-[13px] text-muted">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

export function SettingsView() {
  return (
    <PageFrame>
      <PageHeader title="프로필·알림 설정" />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <LoginRequired reason="프로필과 알림 설정은 계정에 저장돼요.">
          <ProfileCard />
        </LoginRequired>
        <div className="space-y-4">
          <ThemeCard />
          <LoginRequired reason="알림 설정은 계정에 저장돼요." fallback={null}>
            <div className="space-y-4">
              <AlertCard />
              <AccountCard />
            </div>
          </LoginRequired>
        </div>
      </div>
    </PageFrame>
  );
}

function ThemeCard() {
  const pref = useThemePreference();
  return (
    <Card id="theme" title="화면 테마" description="선택은 이 브라우저에 저장되어 새로고침해도 유지돼요.">
      <div role="radiogroup" aria-label="화면 테마" className="flex flex-wrap gap-2">
        {(
          [
            ["light", "라이트"],
            ["dark", "다크"],
            ["system", "시스템 설정 따르기"],
          ] as [ThemePreference, string][]
        ).map(([v, l]) => (
          <label key={v} className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-[13px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="radio" name="theme" checked={pref === v} onChange={() => setThemePreference(v)} className="accent-[var(--accent)]" />
            {l}
          </label>
        ))}
      </div>
    </Card>
  );
}

function ProfileCard() {
  const { state, update } = usePersonal();
  const toast = useToast();
  const initial: UserProfile = state.profile ?? { interests: [], region: null, career: null, teamSize: null, startupYears: null };
  const [draft, setDraft] = useState(initial);
  const [teamText, setTeamText] = useState(initial.teamSize?.toString() ?? "");
  const [startupText, setStartupText] = useState(initial.startupYears?.toString() ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const startupRelevant = draft.interests.includes("startup");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const candidate = {
      ...draft,
      teamSize: teamText === "" ? null : Number(teamText),
      startupYears: !startupRelevant || startupText === "" ? null : Number(startupText),
    };
    const parsed = userProfileSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        next[key] = key === "teamSize" ? "팀 규모는 1~50 사이 숫자로 입력하세요." : key === "startupYears" ? "창업 업력은 0~30 사이 숫자로 입력하세요." : "입력값을 확인하세요.";
      }
      setErrors(next);
      return;
    }
    setErrors({});
    update((s) => ({ ...s, profile: parsed.data }));
    toast({ message: "프로필을 저장했어요. 공고 조건 비교에 바로 반영돼요." });
  };

  return (
    <Card id="profile" title="내 프로필" description="공고 자격 조건과 비교할 때만 써요. 이름·연락처·주소·이력서는 받지 않아요.">
      <form onSubmit={submit} className="space-y-5 text-[13px]" noValidate>
        <fieldset>
          <legend className="mb-2 font-semibold">관심 분야</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <label key={c} className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={draft.interests.includes(c)}
                  onChange={() =>
                    setDraft((d) => ({ ...d, interests: d.interests.includes(c) ? d.interests.filter((x) => x !== c) : [...d.interests, c] }))
                  }
                />
                {CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-semibold">활동 지역</span>
            <select
              value={draft.region ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, region: (e.target.value || null) as UserProfile["region"] }))}
              className="h-10 w-full rounded-md border border-line bg-panel px-2"
            >
              <option value="">선택 안 함</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">시·도 단위만 받아요.</span>
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">경력 구간</span>
            <select
              value={draft.career ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, career: (e.target.value || null) as UserProfile["career"] }))}
              className="h-10 w-full rounded-md border border-line bg-panel px-2"
            >
              <option value="">선택 안 함</option>
              {CAREER_BUCKETS.map((c) => (
                <option key={c} value={c}>
                  {CAREER_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">팀 규모(명)</span>
            <input
              inputMode="numeric"
              value={teamText}
              onChange={(e) => setTeamText(e.target.value.replace(/[^0-9]/g, ""))}
              aria-invalid={Boolean(errors.teamSize)}
              aria-describedby={errors.teamSize ? "team-error" : undefined}
              className="num h-10 w-full rounded-md border border-line bg-panel px-2 aria-[invalid=true]:border-danger"
              placeholder="예: 3"
            />
            {errors.teamSize ? (
              <span id="team-error" className="mt-1 block text-xs text-danger">
                {errors.teamSize}
              </span>
            ) : null}
          </label>
          {startupRelevant ? (
            <label className="block">
              <span className="mb-1 block font-semibold">창업 업력(년)</span>
              <input
                inputMode="numeric"
                value={startupText}
                onChange={(e) => setStartupText(e.target.value.replace(/[^0-9]/g, ""))}
                aria-invalid={Boolean(errors.startupYears)}
                aria-describedby="startup-hint"
                className="num h-10 w-full rounded-md border border-line bg-panel px-2 aria-[invalid=true]:border-danger"
                placeholder="창업 전이면 0"
              />
              <span id="startup-hint" className={`mt-1 block text-xs ${errors.startupYears ? "text-danger" : "text-muted"}`}>
                {errors.startupYears ?? "창업 지원사업 조건 비교에만 써요. 창업 전이면 0을 입력하세요."}
              </span>
            </label>
          ) : null}
        </div>
        <Button type="submit" variant="primary">
          프로필 저장
        </Button>
      </form>
    </Card>
  );
}

function AlertCard() {
  const { state, update } = usePersonal();
  return (
    <Card id="alerts" title="공고 변경 알림" description="관심 공고이거나 내 캘린더에 연결된 공고가 바뀌면 앱 내 알림으로 알려 드려요.">
      <fieldset className="space-y-2 text-[13px]">
        <legend className="sr-only">알림 받을 변경 종류</legend>
        {(Object.keys(ALERT_LABEL) as (keyof ChangeAlertPrefs)[]).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--accent)]"
              checked={state.changeAlerts[k]}
              onChange={(e) => update((s) => ({ ...s, changeAlerts: { ...s.changeAlerts, [k]: e.target.checked } }))}
            />
            {ALERT_LABEL[k]}
          </label>
        ))}
      </fieldset>
      <p className="mt-3 text-xs text-muted">일정별 알림(7일 전·3일 전 등)은 캘린더에서 일정마다 설정해요.</p>
    </Card>
  );
}

function AccountCard() {
  const router = useRouter();
  const toast = useToast();
  const { state } = usePersonal();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await action();
      toast({ message });
      router.push("/discover");
    } catch {
      toast({ message: "처리하지 못했어요. 잠시 후 다시 시도해 주세요.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card id="account" title="계정" description={`${state.session?.displayName ?? ""} · 카카오 로그인. 관심 공고·일정·알림·지원 현황은 계정에 저장돼요.`}>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <p className="font-semibold text-danger">탈퇴하면 계정과 저장한 모든 데이터가 지워져요. 되돌릴 수 없어요.</p>
          <Button onClick={() => setConfirm(false)} disabled={busy}>
            취소
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => run(deleteAccount, "탈퇴했어요. 저장된 데이터를 모두 지웠어요.")}>
            탈퇴하기
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => run(signOut, "로그아웃했어요.")}>
            로그아웃
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => setConfirm(true)}>
            회원 탈퇴
          </Button>
        </div>
      )}
    </Card>
  );
}
