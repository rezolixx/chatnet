export type SafeUser = {
  nickname: string;
  avatar: string | null;
  pays: string | null;
  description: string | null;
  inscritDepuis: string | null;
};

export type AuthErrorCode = "INVALID_INPUT" | "INVALID_CREDENTIALS" | "AUTH_REQUIRED" | "SESSION_EXPIRED" | "RATE_LIMITED" | "UNAVAILABLE";
