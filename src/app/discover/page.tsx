import type { Metadata } from "next";
import { DiscoverView } from "./discover-view";

export const metadata: Metadata = { title: "발견" };

export default function DiscoverPage() {
  return <DiscoverView />;
}
