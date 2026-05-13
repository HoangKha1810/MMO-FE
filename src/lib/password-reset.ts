import crypto from 'crypto';

export function buildPasswordResetToken(userId: number, email: string) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${String(email || '').trim().toLowerCase()}:${process.env.ENCRYPTION_KEY || 'legacy'}`)
    .digest('hex')
    .slice(0, 32);
}
