const DEFAULT_EMAIL_VERIFICATION_ROLLOUT_AT = '2026-05-14T00:00:00+07:00';

export function getEmailVerificationRolloutDate() {
  const raw = String(process.env.EMAIL_VERIFICATION_ROLLOUT_AT || DEFAULT_EMAIL_VERIFICATION_ROLLOUT_AT).trim();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(DEFAULT_EMAIL_VERIFICATION_ROLLOUT_AT) : parsed;
}

export function isEmailVerificationRolloutEnabled(now = new Date()) {
  return now.getTime() >= getEmailVerificationRolloutDate().getTime();
}

export function shouldRequireEmailVerificationForUser(input: {
  createdAt: Date | string | null | undefined;
  emailVerified: boolean | null | undefined;
}) {
  const createdAt = input.createdAt instanceof Date ? input.createdAt : new Date(String(input.createdAt || ''));
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  return createdAt.getTime() >= getEmailVerificationRolloutDate().getTime() && !Boolean(input.emailVerified);
}
