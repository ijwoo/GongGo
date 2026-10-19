import type { Metadata } from "next";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "프로필·알림 설정" };

export default function SettingsPage() {
  return <SettingsView />;
}
