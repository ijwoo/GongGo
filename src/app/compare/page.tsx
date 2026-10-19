import type { Metadata } from "next";
import { CompareView } from "./compare-view";

export const metadata: Metadata = { title: "공고 비교" };

export default function ComparePage() {
  return <CompareView />;
}
