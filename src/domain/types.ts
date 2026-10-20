import { z } from "zod";

/**
 * 도메인 모델.
 *
 * 날짜·시각 표현 규칙
 * - 특정 시점(instant)은 UTC ISO 문자열(`2026-10-31T09:00:00.000Z`)로 저장한다.
 * - 시각이 없는 날짜는 Asia/Seoul 기준 `YYYY-MM-DD` 문자열로 따로 저장한다.
 * - 값이 없거나 고정 날짜로 바꿀 수 없는 경우(상시 모집, 예산 소진 시, 미정)는
 *   별도 type으로 표현하고 임의의 날짜로 바꾸지 않는다.
 */

export const isoInstant = z.iso.datetime({ offset: true });
export const localDate = z.iso.date(); // YYYY-MM-DD (Asia/Seoul 기준)

export const CATEGORIES = ["hackathon", "startup", "education", "event", "job"] as const;
export const categorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const PARTICIPATION_MODES = ["online", "offline", "hybrid"] as const;
export const participationModeSchema = z.enum(PARTICIPATION_MODES);
export type ParticipationMode = z.infer<typeof participationModeSchema>;

export const REGIONS = [
  "서울",
  "경기",
  "인천",
  "강원",
  "충청",
  "전라",
  "경상",
  "제주",
] as const;
export const regionSchema = z.enum(REGIONS);
export type Region = z.infer<typeof regionSchema>;

/** 신청 마감 */
export const deadlineSchema = z.discriminatedUnion("type", [
  /** 날짜와 시각이 모두 공지됨 */
  z.object({ type: z.literal("datetime"), at: isoInstant }),
  /** 날짜만 공지됨. 시각은 알 수 없음 */
  z.object({ type: z.literal("date"), date: localDate }),
  /** 상시 모집 */
  z.object({ type: z.literal("rolling") }),
  /** 예산 소진 시 마감 */
  z.object({ type: z.literal("untilBudget"), note: z.string().optional() }),
  /** 아직 공지되지 않음 */
  z.object({ type: z.literal("tbd") }),
]);
export type Deadline = z.infer<typeof deadlineSchema>;

/** 신청 시작 */
export const applicationStartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("datetime"), at: isoInstant }),
  z.object({ type: z.literal("date"), date: localDate }),
  z.object({ type: z.literal("tbd") }),
]);
export type ApplicationStart = z.infer<typeof applicationStartSchema>;

/** 행사·교육 일정 */
export const eventScheduleSchema = z.discriminatedUnion("type", [
  /** 종일 일정. end는 마지막 날(포함) */
  z.object({ type: z.literal("dates"), start: localDate, end: localDate }),
  z.object({ type: z.literal("datetime"), start: isoInstant, end: isoInstant }),
  z.object({ type: z.literal("tbd") }),
  /** 상시 진행(온라인 강의 등) */
  z.object({ type: z.literal("ongoing") }),
]);
export type EventSchedule = z.infer<typeof eventScheduleSchema>;

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;

/**
 * 위치는 세 종류를 섞지 않는다.
 * - venue: 실제 행사·교육이 열리는 장소. 지도에는 이것만 표시한다.
 * - organizer: 주최기관 주소. 행사 장소로 대신 쓰지 않는다.
 * - 지원 자격상 지역은 위치가 아니라 조건이므로 `eligibilityRegions`에 둔다.
 */
export const venueSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("confirmed"),
    name: z.string(),
    address: z.string(),
    district: z.string(),
    coordinates: coordinatesSchema,
  }),
  /**
   * 오프라인이지만 정확한 장소는 미정·미공개. 정확한 좌표를 만들지 않는다.
   * area: '서울 강남구'처럼 시·구 단위로만 알려진 지역과, 있으면 그 지역의 대략 위치(지오코딩 결과).
   * 지도에는 '대략 위치'로 정확한 장소와 구분해 표시한다.
   */
  z.object({
    status: z.literal("tbd"),
    note: z.string().optional(),
    area: z.object({ label: z.string(), coordinates: coordinatesSchema.optional() }).optional(),
  }),
  /** 온라인 전용 */
  z.object({ status: z.literal("online"), platform: z.string().optional() }),
]);
export type Venue = z.infer<typeof venueSchema>;

export const organizerSchema = z.object({
  name: z.string(),
  /** 기관 주소(텍스트). 지도에 표시하지 않는다 */
  address: z.string().nullable(),
  /** 단색 기관 아이콘 색 */
  color: z.string(),
});

export const teamSizeSchema = z
  .object({
    min: z.number().int().positive().optional(),
    max: z.number().int().positive().optional(),
    note: z.string().optional(),
  })
  .nullable(); // null = 정보 없음

export const costSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("free") }),
    z.object({ type: z.literal("paid"), amountKrw: z.number().int().positive() }),
  ])
  .nullable();

export const supportSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("amount"), maxKrw: z.number().int().positive(), note: z.string().optional() }),
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({ type: z.literal("none") }),
  ])
  .nullable();

/**
 * 프로필과 기계적으로 비교할 수 있는 규칙.
 * 원문을 규칙으로 옮길 수 없으면 rule을 비워 두고 '확인 필요'로 처리한다.
 */
export const conditionRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("region"), regions: z.array(regionSchema).min(1) }),
  z.object({ type: z.literal("careerMaxYears"), years: z.number().int().nonnegative() }),
  z.object({ type: z.literal("careerMinYears"), years: z.number().int().nonnegative() }),
  z.object({ type: z.literal("teamSize"), min: z.number().int().positive().optional(), max: z.number().int().positive().optional() }),
  z.object({ type: z.literal("startupYearsMax"), years: z.number().int().nonnegative() }),
  z.object({ type: z.literal("student") }),
]);
export type ConditionRule = z.infer<typeof conditionRuleSchema>;

export const eligibilityConditionSchema = z.object({
  id: z.string(),
  kind: z.enum(["required", "preferred"]),
  /** 화면에 보여 줄 조건 요약 */
  text: z.string(),
  /** 근거가 되는 원문 문장 */
  evidence: z.string(),
  /**
   * source: 원문에 그대로 있는 사실
   * ai-demo: AI가 구조화한 결과(데모에서는 미리 준비된 값)
   */
  origin: z.enum(["source", "ai-demo"]),
  rule: conditionRuleSchema.optional(),
});
export type EligibilityCondition = z.infer<typeof eligibilityConditionSchema>;

export const REVISION_KINDS = ["deadline", "venue", "conditions", "cancel"] as const;
export const revisionKindSchema = z.enum(REVISION_KINDS);
export type RevisionKind = z.infer<typeof revisionKindSchema>;

export const announcementRevisionSchema = z.object({
  id: z.string(),
  /** 이 변경이 적용된 뒤의 contentVersion */
  version: z.number().int().positive(),
  changedAt: isoInstant,
  kind: revisionKindSchema,
  summary: z.string(),
  before: z.string(),
  after: z.string(),
});
export type AnnouncementRevision = z.infer<typeof announcementRevisionSchema>;

export const announcementSchema = z.object({
  id: z.string(),
  title: z.string(),
  organizer: organizerSchema,
  category: categorySchema,
  sourceId: z.string(),
  sourceUrl: z.url(),
  sourceName: z.string(),
  publishedAt: isoInstant,
  sourceUpdatedAt: isoInstant,
  lastCheckedAt: isoInstant,
  applicationStart: applicationStartSchema,
  applicationDeadline: deadlineSchema,
  event: eventScheduleSchema,
  participationMode: participationModeSchema,
  venue: venueSchema,
  /** 지원 자격상 요구되는 지역. 빈 배열이면 제한 없음 */
  eligibilityRegions: z.array(regionSchema),
  teamSize: teamSizeSchema,
  cost: costSchema,
  supportAmount: supportSchema,
  conditions: z.array(eligibilityConditionSchema),
  requiredDocuments: z.array(z.string()),
  /** 목록의 '확인할 사항' 열. 지원 전에 원문에서 꼭 확인할 것 */
  checkPoints: z.array(z.string()),
  status: z.enum(["active", "cancelled"]),
  contentVersion: z.number().int().positive(),
  revisions: z.array(announcementRevisionSchema),
});
export type Announcement = z.infer<typeof announcementSchema>;

/* ───────────── 개인 상태 ───────────── */

export const CAREER_BUCKETS = ["student", "0-2", "3-5", "6+"] as const;
export const careerBucketSchema = z.enum(CAREER_BUCKETS);
export type CareerBucket = z.infer<typeof careerBucketSchema>;

export const userProfileSchema = z.object({
  interests: z.array(categorySchema),
  region: regionSchema.nullable(),
  career: careerBucketSchema.nullable(),
  teamSize: z.number().int().min(1).max(50).nullable(),
  /** 창업 업력(년). 창업 지원사업에만 필요하므로 선택 입력 */
  startupYears: z.number().int().min(0).max(30).nullable(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const savedAnnouncementSchema = z.object({
  announcementId: z.string(),
  savedAt: isoInstant,
  /** 사용자가 마지막으로 확인한 contentVersion */
  seenVersion: z.number().int().positive(),
});
export type SavedAnnouncement = z.infer<typeof savedAnnouncementSchema>;

/** 캘린더 일정 시각 */
export const timingSchema = z.discriminatedUnion("type", [
  /** 종일 일정. end는 마지막 날(포함). timeUnknown이면 '시각 미공지' */
  z.object({ type: z.literal("allDay"), start: localDate, end: localDate, timeUnknown: z.boolean() }),
  z.object({ type: z.literal("timed"), start: isoInstant, end: isoInstant.nullable() }),
]);
export type Timing = z.infer<typeof timingSchema>;

export const reminderOffsetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("preset"), days: z.union([z.literal(7), z.literal(3), z.literal(1), z.literal(0)]) }),
  z.object({
    type: z.literal("custom"),
    days: z.number().int().min(0).max(60),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }),
]);
export type ReminderOffset = z.infer<typeof reminderOffsetSchema>;

export const reminderSchema = z.object({
  id: z.string(),
  offset: reminderOffsetSchema,
  channel: z.enum(["inApp", "email"]),
});
export type Reminder = z.infer<typeof reminderSchema>;

export const EVENT_KINDS = ["deadline", "event", "prep"] as const;
export const eventKindSchema = z.enum(EVENT_KINDS);
export type EventKind = z.infer<typeof eventKindSchema>;

export const calendarEventSchema = z.object({
  id: z.string(),
  announcementId: z.string().nullable(),
  kind: eventKindSchema,
  title: z.string().min(1).max(80),
  timing: timingSchema,
  /** 일정을 만들 때 기준이 된 공고 contentVersion */
  sourceVersion: z.number().int().positive().nullable(),
  reminders: z.array(reminderSchema),
  memo: z.string().max(500),
  createdAt: isoInstant,
  updatedAt: isoInstant,
});
export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(["reminder", "change", "system"]),
  title: z.string(),
  body: z.string(),
  createdAt: isoInstant,
  read: z.boolean(),
  link: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("announcement"), id: z.string() }),
      z.object({ kind: z.literal("event"), id: z.string() }),
    ])
    .nullable(),
  /** 같은 알림을 두 번 만들지 않기 위한 키 */
  dedupeKey: z.string(),
  delivery: z.enum(["delivered", "failed"]),
  failureReason: z.string().optional(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const APPLICATION_STATUSES = ["reviewing", "preparing", "submitted", "closed"] as const;
export const applicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

export const applicationRecordSchema = z.object({
  announcementId: z.string(),
  status: applicationStatusSchema,
  memo: z.string().max(2000),
  checklist: z.array(z.object({ id: z.string(), label: z.string().min(1).max(100), done: z.boolean() })),
  updatedAt: isoInstant,
});
export type ApplicationRecord = z.infer<typeof applicationRecordSchema>;

export const changeAlertPrefsSchema = z.object({
  deadline: z.boolean(),
  venue: z.boolean(),
  conditions: z.boolean(),
  cancel: z.boolean(),
});
export type ChangeAlertPrefs = z.infer<typeof changeAlertPrefsSchema>;
