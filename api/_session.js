const crypto = require('crypto');

const COOKIE_NAME = 'orca_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function parseCookies(req) {
  const raw = String(req.headers?.cookie || '');
  const out = {};
  raw.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(value); } catch (_) { out[key] = value; }
  });
  return out;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

async function ensureSessionTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(company_id, user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at)`;
}

function setCookie(res, value, maxAge = MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}`);
}

async function issueSession(sql, res, companyId, userId) {
  await ensureSessionTable(sql);
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const hash = tokenHash(rawToken);
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);
  await sql`DELETE FROM user_sessions WHERE expires_at <= now()`;
  await sql`
    INSERT INTO user_sessions (company_id, user_id, token_hash, expires_at)
    VALUES (${companyId}, ${userId}, ${hash}, ${expiresAt})
  `;
  setCookie(res, rawToken);
  return rawToken;
}

async function getSessionUser(sql, req) {
  await ensureSessionTable(sql);
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;
  const hash = tokenHash(token);
  const rows = await sql`
    SELECT u.id, u.company_id, u.local_id, u.name, u.email, u.role, u.pin_hash
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash} AND s.expires_at > now()
    LIMIT 1
  `;
  if (!rows.length) return null;
  await sql`UPDATE user_sessions SET last_seen_at=now() WHERE token_hash=${hash}`;
  return rows[0];
}

async function clearSession(sql, req, res) {
  await ensureSessionTable(sql);
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) {
    const hash = tokenHash(token);
    await sql`DELETE FROM user_sessions WHERE token_hash=${hash}`;
  }
  setCookie(res, '', 0);
}

module.exports = {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  parseCookies,
  ensureSessionTable,
  issueSession,
  getSessionUser,
  clearSession
};
