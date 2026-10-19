import type { Metadata } from "next";
import { ApplicationsView } from "./applications-view";

export const metadata: Metadata = { title: "지원 현황" };

export default function ApplicationsPage() {
  return <ApplicationsView />;
}
