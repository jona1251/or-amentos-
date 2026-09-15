const crypto = require('crypto');

const COOKIE_NAME = 'orca_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
let sessionSchemaPromise = null;

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

function sessionInfo(req) {
  const ip = String(req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || '').split(',')[0].trim().slice(0,120);
  const userAgent = String(req?.headers?.['user-agent'] || '').slice(0,500);
  let deviceName = 'Dispositivo';
  if (/Android/i.test(userAgent)) deviceName = 'Android';
  else if (/iPhone|iPad/i.test(userAgent)) deviceName = 'iPhone/iPad';
  else if (/Windows/i.test(userAgent)) deviceName = 'Windows';
  else if (/Mac OS/i.test(userAgent)) deviceName = 'Mac';
  return { ip, userAgent, deviceName };
}

async function ensureSessionTable(sql) {
  if (!sessionSchemaPromise) {
    sessionSchemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS user_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip text`;
      await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent text`;
      await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_name text`;
      await sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(company_id, user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at)`;
    })();
  }
  try { await sessionSchemaPromise; }
  catch (err) { sessionSchemaPromise = null; throw err; }
}

function setCookie(res, value, maxAge = MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${maxAge}; Priority=High`);
}

async function issueSession(sql, res, companyId, userId, req = null) {
  await ensureSessionTable(sql);
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const hash = tokenHash(rawToken);
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);
  const info = sessionInfo(req);
  await sql`DELETE FROM user_sessions WHERE expires_at <= now()`;
  await sql`
    INSERT INTO user_sessions (company_id, user_id, token_hash, expires_at, ip, user_agent, device_name)
    VALUES (${companyId}, ${userId}, ${hash}, ${expiresAt}, ${info.ip || null}, ${info.userAgent || null}, ${info.deviceName})
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
    SELECT u.id, u.company_id, u.local_id, u.name, u.email, u.role, u.pin_hash, s.last_seen_at
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash} AND s.expires_at > now()
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0];
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  if (!lastSeen || Date.now() - lastSeen >= TOUCH_INTERVAL_MS) {
    const info = sessionInfo(req);
    await sql`
      UPDATE user_sessions
      SET last_seen_at=now(),
          ip=COALESCE(${info.ip || null},ip),
          user_agent=COALESCE(${info.userAgent || null},user_agent),
          device_name=COALESCE(${info.deviceName || null},device_name)
      WHERE token_hash=${hash}
    `;
  }
  delete row.last_seen_at;
  return row;
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
