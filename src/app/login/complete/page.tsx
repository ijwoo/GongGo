import type { Metadata } from "next";
import { LoginComplete } from "./login-complete";

export const metadata: Metadata = { title: "로그인" };

export default function Page() {
  return <LoginComplete />;
}
