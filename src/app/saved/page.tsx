import type { Metadata } from "next";
import { SavedView } from "./saved-view";

export const metadata: Metadata = { title: "관심 공고" };

export default function SavedPage() {
  return <SavedView />;
}
