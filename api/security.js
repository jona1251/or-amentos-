const { getSql, ensureCompany, authenticate, send } = require('./_db');
const {
  ensureRateLimitTable,
  accountRateKey,
  retrySeconds,
  ACCOUNT_MAX_ATTEMPTS,
  IP_MAX_ATTEMPTS,
  WINDOW_SECONDS,
  BLOCK_SECONDS
} = require('./_rate_limit');

module.exports = async function handler(req, res) {
  try {
    const sql = getSql();
    const company = await ensureCompany(sql);
    const current = await authenticate(sql, req);
    if (!current) return send(res, 401, { ok:false, error:'UNAUTHORIZED' });
    if (current.role !== 'admin') return send(res, 403, { ok:false, error:'ADMIN_ONLY' });

    await ensureRateLimitTable(sql);

    if (req.method === 'GET') {
      const users = await sql`
        SELECT id, local_id, name, email, role, created_at
        FROM users
        WHERE company_id=${company.id}
        ORDER BY created_at ASC
      `;
      const limits = await sql`
        SELECT rate_key, attempts, window_started, blocked_until, updated_at
        FROM login_rate_limits
        WHERE company_id=${company.id}
        ORDER BY updated_at DESC
      `;

      const byKey = new Map(limits.map(row => [row.rate_key, row]));
      const now = Date.now();
      const windowMs = WINDOW_SECONDS * 1000;

      const userStates = users.map(user => {
        const key = accountRateKey(company.id, user.local_id);
        const state = byKey.get(key);
        const retryAfter = state ? retrySeconds(state.blocked_until) : 0;
        const activeWindow = !!state && new Date(state.window_started).getTime() >= now - windowMs;
        const attempts = state && (activeWindow || retryAfter > 0) ? Number(state.attempts || 0) : 0;
        return {
          id:user.id,
          login:user.local_id,
          name:user.name,
          email:user.email || '',
          role:user.role,
          attempts,
          attemptsRemaining:Math.max(0, ACCOUNT_MAX_ATTEMPTS - attempts),
          blocked:retryAfter > 0,
          retryAfter,
          blockedUntil:retryAfter > 0 ? state.blocked_until : null,
          windowStarted:activeWindow ? state.window_started : null,
          updatedAt:state?.updated_at || null
        };
      });

      const ipStates = limits.filter(row => String(row.rate_key || '').startsWith('ip:'));
      const blockedIpBuckets = ipStates.filter(row => retrySeconds(row.blocked_until) > 0).length;
      const activeIpBuckets = ipStates.filter(row => new Date(row.window_started).getTime() >= now - windowMs).length;

      return send(res, 200, {
        ok:true,
        policy:{
          accountMaxAttempts:ACCOUNT_MAX_ATTEMPTS,
          ipMaxAttempts:IP_MAX_ATTEMPTS,
          windowSeconds:WINDOW_SECONDS,
          blockSeconds:BLOCK_SECONDS
        },
        summary:{
          users:users.length,
          blockedUsers:userStates.filter(u => u.blocked).length,
          failedAttempts:userStates.reduce((sum,u)=>sum+u.attempts,0),
          activeIpBuckets,
          blockedIpBuckets
        },
        users:userStates
      });
    }

    if (req.method === 'POST') {
      const action = String(req.body?.action || '');

      if (action === 'unlockUser') {
        const userId = String(req.body?.userId || '').trim();
        if (!userId) return send(res, 400, { ok:false, error:'USER_ID_REQUIRED' });
        const targetRows = await sql`
          SELECT id, local_id, name FROM users
          WHERE company_id=${company.id} AND id::text=${userId}
          LIMIT 1
        `;
        if (!targetRows.length) return send(res, 404, { ok:false, error:'USER_NOT_FOUND' });
        const target = targetRows[0];
        const key = accountRateKey(company.id, target.local_id);
        await sql`DELETE FROM login_rate_limits WHERE company_id=${company.id} AND rate_key=${key}`;
        await sql`
          INSERT INTO audit_log (company_id, user_id, entity_type, entity_id, action)
          VALUES (${company.id}, ${current.id}, 'security', ${target.id}, 'unlock_login')
        `;
        return send(res, 200, { ok:true, unlocked:true, user:{id:target.id,name:target.name,login:target.local_id} });
      }

      if (action === 'clearIpBlocks') {
        await sql`DELETE FROM login_rate_limits WHERE company_id=${company.id} AND rate_key LIKE 'ip:%'`;
        await sql`
          INSERT INTO audit_log (company_id, user_id, entity_type, action)
          VALUES (${company.id}, ${current.id}, 'security', 'clear_ip_rate_limits')
        `;
        return send(res, 200, { ok:true, cleared:true });
      }

      return send(res, 400, { ok:false, error:'INVALID_ACTION' });
    }

    return send(res, 405, { ok:false, error:'METHOD_NOT_ALLOWED' });
  } catch (err) {
    const missing = err?.message === 'DATABASE_URL_NOT_CONFIGURED';
    console.error('security', err);
    return send(res, missing ? 503 : 500, { ok:false, error:missing ? 'DATABASE_NOT_CONNECTED' : 'SERVER_ERROR' });
  }
};
