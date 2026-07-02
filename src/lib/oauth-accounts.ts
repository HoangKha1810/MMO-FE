import 'server-only';

import { db } from '@/lib/db';

const globalForOAuthAccounts = globalThis as unknown as {
  oauthAccountsTableReady?: Promise<void>;
};

export interface OAuthAccountRow {
  id: number | bigint;
  user_id: number;
  provider: string;
  provider_account_id: string;
  email: string | null;
}

export async function ensureOAuthAccountsTable() {
  if (!globalForOAuthAccounts.oauthAccountsTableReady) {
    globalForOAuthAccounts.oauthAccountsTableReady = db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_oauth_accounts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        provider VARCHAR(32) NOT NULL,
        provider_account_id VARCHAR(191) NOT NULL,
        email VARCHAR(191) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_user_oauth_provider_account (provider, provider_account_id),
        KEY idx_user_oauth_user (user_id),
        KEY idx_user_oauth_email (email)
      )
    `).then(() => undefined).catch((error) => {
      globalForOAuthAccounts.oauthAccountsTableReady = undefined;
      throw error;
    });
  }

  return globalForOAuthAccounts.oauthAccountsTableReady;
}

export async function findOAuthAccount(provider: string, providerAccountId: string) {
  await ensureOAuthAccountsTable();

  const rows = await db.$queryRawUnsafe<OAuthAccountRow[]>(
    `
      SELECT id, user_id, provider, provider_account_id, email
      FROM user_oauth_accounts
      WHERE provider = ?
        AND provider_account_id = ?
      LIMIT 1
    `,
    provider,
    providerAccountId
  );

  return rows[0] || null;
}

export async function upsertOAuthAccount(input: {
  userId: number;
  provider: string;
  providerAccountId: string;
  email?: string | null;
}) {
  await ensureOAuthAccountsTable();

  await db.$executeRawUnsafe(
    `
      INSERT INTO user_oauth_accounts (user_id, provider, provider_account_id, email)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        email = VALUES(email),
        updated_at = NOW()
    `,
    Math.trunc(Number(input.userId)),
    input.provider.trim().toLowerCase().slice(0, 32),
    input.providerAccountId.trim().slice(0, 191),
    input.email ? input.email.trim().toLowerCase().slice(0, 191) : null
  );
}
