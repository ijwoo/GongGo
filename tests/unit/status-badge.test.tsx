// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeadlineCell, StateBadge } from "@/components/discover/status";
import { NOW, byId } from "./fixtures";

describe("상태 표시는 색과 글자를 함께 쓴다", () => {
  it("마감 임박", () => {
    render(<StateBadge a={byId("hk-seongsu-climate")} now={NOW} />);
    expect(screen.getByText("마감 D-2")).toBeInTheDocument();
  });
  it("취소된 공고", () => {
    render(<StateBadge a={byId("hk-yeouido-cancel")} now={NOW} />);
    expect(screen.getByText("취소됨")).toBeInTheDocument();
  });
  it("시각 미공지 마감은 시각을 지어내지 않는다", () => {
    render(<DeadlineCell a={byId("hk-seongsu-climate")} now={NOW} />);
    expect(screen.getByText(/시각 미공지/)).toBeInTheDocument();
    expect(screen.queryByText(/23:59/)).toBeNull();
  });
  it("상시 모집", () => {
    render(<DeadlineCell a={byId("su-rolling-mentoring")} now={NOW} />);
    expect(screen.getByText("상시 모집")).toBeInTheDocument();
  });
});
