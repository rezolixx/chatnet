export type PasswordErrors = { new_password?: string };

// Laravel PasswordPolicy / registration rules, which mirror NickServ's
// (nickserv.conf minpasslen = 10, maxpasslen = 50 bytes). Laravel stays authoritative.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 50;

export const passwordMessages = {
  policy: "Le mot de passe doit contenir au moins 10 caractères, sans espaces.",
  nickname: "Le mot de passe doit être différent de votre pseudo.",
  tooLong: "Le mot de passe ne doit pas dépasser 50 caractères.",
};

// The hint shown next to every field that creates or changes a password.
export const passwordHint = "Au moins 10 caractères, sans espaces, différent de votre pseudo.";

function utf8Length(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) as number;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Returns the first rule a new password breaks, or undefined when it is valid.
 * Whitespace is refused anywhere (NickServ would split the argument), as are
 * control characters (XML-RPC cannot carry them). Length is counted in
 * characters like Laravel's min rule; the maximum is in UTF-8 bytes like
 * NickServ's maxpasslen. Never used for login: existing passwords still work.
 */
export function passwordPolicyError(password: unknown, nickname?: string | null): string | undefined {
  if (typeof password !== "string") return passwordMessages.policy;
  if (/[\s\u0000-\u001f\u007f]/.test(password) || Array.from(password).length < PASSWORD_MIN_LENGTH) return passwordMessages.policy;
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return passwordMessages.tooLong;
  if (typeof nickname === "string" && nickname.trim() && password.toLowerCase() === nickname.trim().toLowerCase()) return passwordMessages.nickname;
  return undefined;
}

/**
 * Maps a Laravel password validation message to one of ours. Only fixed,
 * known server texts are recognised; anything else gets the policy message,
 * so an upstream string (which could echo a secret) is never copied.
 */
export function passwordMessageFromUpstream(message: unknown): string {
  if (typeof message !== "string") return passwordMessages.policy;
  if (/^Le mot de passe ne doit pas être identique au pseudo\.$/.test(message)) return passwordMessages.nickname;
  if (/^Le mot de passe ne doit pas dépasser \d+ caractères\.$/.test(message)) return passwordMessages.tooLong;
  return passwordMessages.policy;
}

export function validatePasswordInput(value: unknown, nickname?: string | null): { input?: { new_password: string }; errors: PasswordErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: {} };
  const fields = value as Record<string, unknown>;
  if (Object.keys(fields).length !== 1 || !Object.hasOwn(fields, "new_password")) return { errors: {} };
  const password = fields.new_password;
  const error = passwordPolicyError(password, nickname);
  if (error) return { errors: { new_password: error } };
  return { input: { new_password: password as string }, errors: {} };
}

export function safePasswordErrors(value: unknown): PasswordErrors {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const errors = (value as Record<string, unknown>).errors;
    if (errors && typeof errors === "object" && Object.hasOwn(errors, "new_password")) {
      const messages = (errors as Record<string, unknown>).new_password;
      return { new_password: passwordMessageFromUpstream(Array.isArray(messages) ? messages[0] : messages) };
    }
  }
  return { new_password: "Vérifiez le nouveau mot de passe." };
}
