import "server-only";

/**
 * 이메일 발송 경계.
 * EMAIL_PROVIDER와 EMAIL_API_KEY가 모두 있을 때만 '설정됨'으로 본다.
 * 현재 저장소에는 실제 발송 구현이 없다. 설정돼 있어도 화면은 실제 발송했다고 표시하지 않는다.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_API_KEY);
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** 같은 알림을 두 번 보내지 않기 위한 키(제공자의 idempotency key로 전달) */
  idempotencyKey: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{ ok: true; providerId: string } | { ok: false; retryable: boolean; reason: string }>;
}

/** 제공자를 붙이기 전까지 쓰는 구현. 항상 실패를 돌려주므로 실제로 보냈다고 오해할 일이 없다 */
export const unconfiguredEmailSender: EmailSender = {
  async send() {
    return { ok: false, retryable: false, reason: "이메일 발송 제공자가 설정되지 않았습니다." };
  },
};
