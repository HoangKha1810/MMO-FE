import crypto from 'crypto';

export function generateEmailVerificationCode() {
  return String(crypto.randomInt(100000, 999999));
}

export function getEmailVerificationExpiresAt(minutes = 15) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
