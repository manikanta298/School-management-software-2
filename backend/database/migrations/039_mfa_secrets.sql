-- Batch 4 part 2: TOTP MFA secrets (D8). The secret is stored as a base32 string; enrollment requires
-- a fresh login and produces a one-time QR code; verification requires a 6-digit TOTP code.
-- Backup codes are not generated in this phase.
CREATE TABLE user_mfa_secrets (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 secret text NOT NULL,
 enabled_at timestamptz NOT NULL DEFAULT now(),
 last_used_at timestamptz
);
CREATE INDEX user_mfa_secrets_enabled_idx ON user_mfa_secrets(user_id) WHERE enabled_at IS NOT NULL;
