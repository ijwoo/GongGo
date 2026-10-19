import { EVENT_KIND_LABEL } from "./calendar";
import { addLocalDays } from "./time";
import type { Announcement, CalendarEvent } from "./types";

/**
 * iCalendar(RFC 5545) 내보내기.
 * - 줄바꿈은 CRLF, 한 줄은 75옥텟(UTF-8 바이트)을 넘으면 접는다.
 * - 텍스트의 \ ; , 줄바꿈은 이스케이프한다.
 * - 종일 일정은 VALUE=DATE, DTEND는 마지막 날의 다음 날(배타적).
 * - 시각 일정은 UTC(Z)로 쓴다. 시간대 정의(VTIMEZONE)를 넣지 않아도 어느 캘린더에서나 같은 시점이 된다.
 * - 한 번 내려받는 파일이며 이후 변경은 자동으로 동기화되지 않는다.
 */
const CRLF = "\r\n";

export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** 75옥텟 단위로 접기. 멀티바이트 문자를 중간에서 자르지 않는다 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // 이어지는 줄은 앞 공백 1바이트 포함
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function basicDate(date: string): string {
  return date.replaceAll("-", "");
}

function basicUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface IcsOptions {
  nowIso: string;
  announcements: Map<string, Announcement>;
  domain?: string;
}

export function buildIcs(events: CalendarEvent[], { nowIso, announcements, domain = "gonggoham.app" }: IcsOptions): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gonggoham//Calendar Export//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:공고함 내 일정",
  ];

  for (const e of events) {
    const a = e.announcementId ? announcements.get(e.announcementId) : undefined;
    const notes = [
      `[${EVENT_KIND_LABEL[e.kind]}]`,
      a ? `공고: ${a.title} (${a.organizer.name})` : null,
      e.timing.type === "allDay" && e.timing.timeUnknown ? "마감 시각이 공지되지 않았습니다. 원문을 확인하세요." : null,
      e.memo || null,
      a ? `원문: ${a.sourceUrl}` : null,
    ].filter(Boolean);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@${domain}`);
    lines.push(`DTSTAMP:${basicUtc(nowIso)}`);
    lines.push(`LAST-MODIFIED:${basicUtc(e.updatedAt)}`);
    if (e.timing.type === "allDay") {
      lines.push(`DTSTART;VALUE=DATE:${basicDate(e.timing.start)}`);
      lines.push(`DTEND;VALUE=DATE:${basicDate(addLocalDays(e.timing.end, 1))}`);
    } else {
      lines.push(`DTSTART:${basicUtc(e.timing.start)}`);
      if (e.timing.end) lines.push(`DTEND:${basicUtc(e.timing.end)}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    lines.push(`DESCRIPTION:${escapeText(notes.join("\n"))}`);
    if (a?.venue.status === "confirmed") lines.push(`LOCATION:${escapeText(`${a.venue.name}, ${a.venue.address}`)}`);
    if (a) lines.push(`URL:${a.sourceUrl}`);
    lines.push(`CATEGORIES:${escapeText(EVENT_KIND_LABEL[e.kind])}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
