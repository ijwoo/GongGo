import type { Metadata } from "next";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "내 캘린더" };

export default function CalendarPage() {
  return <CalendarView />;
}
