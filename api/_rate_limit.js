const crypto = require('crypto');

const WINDOW_SECONDS = 15 * 60;
const BLOCK_SECONDS = 15 * 60;
const ACCOUNT_MAX_ATTEMPTS = 5;
const IP_MAX_ATTEMPTS = 20;

let tablePromise = null;

function hashKey(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const real = String(req.headers['x-real-ip'] || '').trim();
  return forwarded || real || 'unknown';
}

function rateKeys(companyId, login, req) {
  const account = `acct:${hashKey(`${companyId}:${String(login || '').toLowerCase()}`)}`;
  const ip = `ip:${hashKey(`${companyId}:${getClientIp(req)}`)}`;
  return { account, ip };
}

async function ensureRateLimitTable(sql) {
  if (!tablePromise) {
    tablePromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS login_rate_limits (
        rate_key text PRIMARY KEY,
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        attempts integer NOT NULL DEFAULT 0,
        window_started timestamptz NOT NULL DEFAULT now(),
        blocked_until timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_login_rate_limits_company_updated ON login_rate_limits(company_id, updated_at DESC)`;
    })();
  }
  try {
    await tablePromise;
  } catch (err) {
    tablePromise = null;
    throw err;
  }
}

function retrySeconds(dateValue) {
  if (!dateValue) return 0;
  const ms = new Date(dateValue).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

async function checkLoginRateLimit(sql, companyId, login, req) {
  await ensureRateLimitTable(sql);
  const { account, ip } = rateKeys(companyId, login, req);
  const rows = await sql`
    SELECT rate_key, blocked_until
    FROM login_rate_limits
    WHERE company_id=${companyId} AND rate_key IN (${account}, ${ip})
  `;
  let retryAfter = 0;
  let scope = null;
  for (const row of rows) {
    const retry = retrySeconds(row.blocked_until);
    if (retry > retryAfter) {
      retryAfter = retry;
      scope = row.rate_key === account ? 'account' : 'ip';
    }
  }
  return { limited: retryAfter > 0, retryAfter, scope };
}

async function bumpFailure(sql, companyId, key, maxAttempts) {
  const rows = await sql`
    INSERT INTO login_rate_limits (rate_key, company_id, attempts, window_started, blocked_until, updated_at)
    VALUES (${key}, ${companyId}, 1, now(), null, now())
    ON CONFLICT (rate_key) DO UPDATE SET
      attempts = CASE
        WHEN login_rate_limits.window_started < now() - (${WINDOW_SECONDS} * interval '1 second') THEN 1
        ELSE login_rate_limits.attempts + 1
      END,
      window_started = CASE
        WHEN login_rate_limits.window_started < now() - (${WINDOW_SECONDS} * interval '1 second') THEN now()
        ELSE login_rate_limits.window_started
      END,
      blocked_until = CASE
        WHEN login_rate_limits.blocked_until > now() THEN login_rate_limits.blocked_until
        WHEN (CASE
          WHEN login_rate_limits.window_started < now() - (${WINDOW_SECONDS} * interval '1 second') THEN 1
          ELSE login_rate_limits.attempts + 1
        END) >= ${maxAttempts}
        THEN now() + (${BLOCK_SECONDS} * interval '1 second')
        ELSE null
      END,
      updated_at = now()
    RETURNING attempts, blocked_until
  `;
  return rows[0] || { attempts: 1, blocked_until: null };
}

async function recordFailedLogin(sql, companyId, login, req) {
  await ensureRateLimitTable(sql);
  const { account, ip } = rateKeys(companyId, login, req);
  const accountState = await bumpFailure(sql, companyId, account, ACCOUNT_MAX_ATTEMPTS);
  const ipState = await bumpFailure(sql, companyId, ip, IP_MAX_ATTEMPTS);
  const accountRetry = retrySeconds(accountState.blocked_until);
  const ipRetry = retrySeconds(ipState.blocked_until);
  const retryAfter = Math.max(accountRetry, ipRetry);
  return {
    limited: retryAfter > 0,
    retryAfter,
    scope: ipRetry > accountRetry ? 'ip' : 'account',
    attemptsRemaining: Math.max(0, ACCOUNT_MAX_ATTEMPTS - Number(accountState.attempts || 0))
  };
}

async function clearSuccessfulLogin(sql, companyId, login, req) {
  await ensureRateLimitTable(sql);
  const { account } = rateKeys(companyId, login, req);
  await sql`DELETE FROM login_rate_limits WHERE company_id=${companyId} AND rate_key=${account}`;
  // Limpeza oportunista para impedir crescimento indefinido da tabela.
  await sql`DELETE FROM login_rate_limits WHERE updated_at < now() - interval '7 days'`;
}

module.exports = {
  checkLoginRateLimit,
  recordFailedLogin,
  clearSuccessfulLogin,
  ACCOUNT_MAX_ATTEMPTS,
  WINDOW_SECONDS,
  BLOCK_SECONDS
};
