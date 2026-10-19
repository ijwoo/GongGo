import type { Metadata } from "next";
import { LoginView } from "./login-view";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return <LoginView />;
}
